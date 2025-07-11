const express = require('express');
const router = express.Router();
const postLimiter = require('../middleware/ratelimit');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getIO } = require('../socket');
const { sampleSize } = require('lodash');
const { startChatListenerForStreamer, stopChatListenerForStreamer } = require('../chatBot');
const { encrypt } = require('../utils/crypto');

// GET /dashboard
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { twitchId: req.user.twitchId }
  });

  if (!user) return res.redirect('/auth/twitch');

  const latestGiveaway = await prisma.giveaway.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { entries: true }
  });

  const entries = latestGiveaway?.entries ?? [];
  const encryptedTwitchId = encrypt(user.twitchId);

  const commandUpdated = req.session.commandUpdated ?? null;
  const winners = req.session.winners ?? [];
  const warning = req.session.warning ?? null;

  req.session.commandUpdated = null;
  req.session.winners = null;
  req.session.warning = null;

  res.render('dashboard', {
    user,
    entries,
    commandUpdated,
    winners,
    warning,
    encryptedTwitchId
  });
});

// POST /dashboard/command
router.post('/dashboard/command', postLimiter, async (req, res) => {
  const userId = req.user.id;
  const twitchId = req.user.twitchId;
  const command = req.body.command?.trim();

  if (!command || command.length > 30) {
    return res.redirect('/dashboard');
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { command }
      }),
      prisma.giveaway.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
      }),
      prisma.giveaway.create({
        data: {
          title: 'Untitled Giveaway',
          command,
          isActive: true,
          userId
        }
      })
    ]);

    const io = getIO();
    const encryptedTwitchId = encrypt(twitchId);
    io.to(encryptedTwitchId).emit('giveawayReset');
    io.to(encryptedTwitchId).emit('commandUpdated', { command }); // ✅ Live command update

    setTimeout(() => {
      stopChatListenerForStreamer(req.user.username);
      startChatListenerForStreamer(req.user.username, twitchId);
    }, 250);

    req.session.commandUpdated = "Command updated successfully!";
    res.redirect('/dashboard');
  } catch (err) {
    console.error("❌ Failed to set command:", err);
    res.redirect('/dashboard');
  }
});

// POST /dashboard/restart
router.post('/dashboard/restart', postLimiter, async (req, res) => {
  const { twitchId, username, id: userId } = req.user;

  try {
    const current = await prisma.giveaway.findFirst({
      where: { userId, isActive: true }
    });

    if (current) {
      await prisma.$transaction([
        prisma.giveaway.update({
          where: { id: current.id },
          data: { isActive: false }
        }),
        prisma.entry.deleteMany({
          where: { giveawayId: current.id }
        }),
      ]);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { command: '!' }
    });

    await prisma.giveaway.create({
      data: {
        title: 'Untitled Giveaway',
        command: '!',
        isActive: true,
        userId
      }
    });

    const io = getIO();
    const encryptedTwitchId = encrypt(twitchId);
    io.to(encryptedTwitchId).emit('giveawayReset');
    io.to(encryptedTwitchId).emit('commandUpdated', { command: '!' }); // ✅ Also update on restart

    setTimeout(() => {
      stopChatListenerForStreamer(username);
      startChatListenerForStreamer(username, twitchId);
    }, 250);

    req.session.commandUpdated = "Giveaway restarted!";
    res.redirect('/dashboard');
  } catch (err) {
    console.error("❌ Failed to restart giveaway:", err);
    res.redirect('/dashboard');
  }
});

// POST /dashboard/kick/:username
router.post('/dashboard/kick/:username', ensureAuthenticated, async (req, res) => {
  const { username } = req.params;
  const { id: userId, twitchId } = req.user;

  try {
    const activeGiveaway = await prisma.giveaway.findFirst({
      where: { userId, isActive: true }
    });

    if (!activeGiveaway) return res.redirect('/dashboard');

    await prisma.entry.deleteMany({
      where: {
        giveawayId: activeGiveaway.id,
        username: username.toLowerCase()
      }
    });

    const io = getIO();
    const encryptedTwitchId = encrypt(twitchId);
    io.to(encryptedTwitchId).emit('kickUser', { username });

    res.redirect('/dashboard');
  } catch (err) {
    console.error("❌ Failed to kick user:", err);
    res.redirect('/dashboard');
  }
});

// POST /dashboard/pick-winners
router.post('/dashboard/pick-winners', postLimiter, async (req, res) => {
  const { twitchId, id: userId } = req.user;
  const numRaw = req.body.numWinners;
  const numWinners = Number.isInteger(Number(numRaw)) && Number(numRaw) > 0
    ? Number(numRaw)
    : 1;

  try {
    const latestGiveaway = await prisma.giveaway.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { entries: true }
    });

    if (!latestGiveaway || latestGiveaway.entries.length === 0) {
      req.session.winners = [];
      req.session.warning = "No entries available to pick a winner.";
      return res.redirect('/dashboard');
    }

    if (latestGiveaway.entries.length < numWinners) {
      req.session.winners = [];
      req.session.warning = `Only ${latestGiveaway.entries.length} entr${latestGiveaway.entries.length === 1 ? 'y' : 'ies'} available — please reduce the number of winners.`;
      return res.redirect('/dashboard');
    }

    const winners = sampleSize(latestGiveaway.entries, numWinners);
    req.session.winners = winners.map(w => w.username);

    const io = getIO();
    const encryptedTwitchId = encrypt(twitchId);

    setTimeout(() => {
      io.to(encryptedTwitchId).emit('winnersAnnounced', {
        winners: req.session.winners
      });
    }, 100);

    res.redirect('/dashboard');
  } catch (err) {
    console.error("❌ Failed to pick winners:", err);
    req.session.warning = "Something went wrong when picking winners.";
    res.redirect('/dashboard');
  }
});

module.exports = router;
