const express = require('express');
const passport = require('passport');
const TwitchStrategy = require('passport-twitch-new').Strategy;
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

const {
  startChatListenerForStreamer,
  stopChatListenerForStreamer
} = require('../chatBot');

passport.use(new TwitchStrategy({
  clientID: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  callbackURL: process.env.TWITCH_CALLBACK_URL,
  scope: ['user:read:email', 'chat:read', 'chat:edit']
}, async (accessToken, refreshToken, profile, done) => {
  try {
	const user = await prisma.user.upsert({
	  where: { twitchId: profile.id },
	  update: {
		accessToken,
		refreshToken, // <-- store it on update
		lastLoginAt: new Date()
	  },
	  create: {
		twitchId: profile.id,
		username: profile.login,
		command: "!giveaway",
		accessToken,
		refreshToken, // <-- store it on create
		lastLoginAt: new Date()
	  }
	});

    stopChatListenerForStreamer(profile.login);
    await startChatListenerForStreamer(profile.login, profile.id);

    return done(null, user);
  } catch (err) {
    console.error('Twitch strategy error:', err);
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await prisma.user.findUnique({ where: { id } });
  done(null, user);
});

router.get('/auth/twitch', passport.authenticate('twitch'));

router.get('/auth/twitch/callback',
  passport.authenticate('twitch', {
    failureRedirect: '/',
    successRedirect: '/dashboard'
  })
);

// ✅ Logout: ends giveaway, deletes entries, and clears session
router.post('/logout', async (req, res, next) => {
  try {
    if (req.user) {
      const { id: userId, twitchId, username } = req.user;

      // Stop chat listener
      stopChatListenerForStreamer(username);

      // Find and delete active giveaway + entries + kicked users in the right order
      const activeGiveaway = await prisma.giveaway.findFirst({
        where: { userId, isActive: true }
      });

      if (activeGiveaway) {
        await prisma.$transaction([
          prisma.kickedUser.deleteMany({
            where: { giveawayId: activeGiveaway.id }
          }),
          prisma.entry.deleteMany({
            where: { giveawayId: activeGiveaway.id }
          }),
          prisma.giveaway.delete({
            where: { id: activeGiveaway.id }
          })
        ]);

        // Emit overlay reset
        const { encrypt } = require('../utils/crypto');
        const { getIO } = require('../socket');
        const io = getIO();
        const encryptedTwitchId = encrypt(twitchId);
        io.to(encryptedTwitchId).emit('giveawayReset');
      }
    }

    // Cleanup session
    req.logout(err => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    });
  } catch (err) {
    console.error("❌ Logout cleanup error:", err);
    res.redirect('/');
  }
});

module.exports = router;
