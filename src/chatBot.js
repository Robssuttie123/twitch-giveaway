const tmi = require('tmi.js');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getIO } = require('./socket');
const { encrypt } = require('./utils/crypto');

const connectedClients = {};
const lockedGiveaways = new Set(); 

// 🔄 Ensure locks are cleared on server restart
lockedGiveaways.clear();

// Lock control functions
function lockGiveaway(userId) {
  lockedGiveaways.add(userId);
}

function unlockGiveaway(userId) {
  lockedGiveaways.delete(userId);
}

function isGiveawayLocked(userId) {
  return lockedGiveaways.has(userId);
}

async function refreshTwitchToken(user) {
  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET
      }
    });

    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });

    console.log(`🔁 Refreshed access token for ${user.username}`);
    return newAccessToken;

  } catch (err) {
    console.error(`❌ Failed to refresh token for ${user.username}`, err.response?.data || err.message);
    return null;
  }
}

async function connectClient(user, twitchUsername) {
  const client = new tmi.Client({
    options: { debug: false },
    identity: {
      username: twitchUsername,
      password: `oauth:${user.accessToken}`
    },
    channels: [twitchUsername]
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    if (err?.message?.includes('Login authentication failed')) {
      console.warn(`⚠️ Token expired for ${twitchUsername}. Attempting refresh...`);
      const newToken = await refreshTwitchToken(user);

      if (!newToken) return null;

      client.opts.identity.password = `oauth:${newToken}`;
      try {
        await client.connect();
        return client;
      } catch (retryErr) {
        console.error(`❌ Reconnection failed for ${twitchUsername}`, retryErr);
        return null;
      }
    } else {
      console.error(`❌ Failed to connect to chat for ${twitchUsername}`, err?.message || err);
      return null;
    }
  }
}

async function startChatListenerForStreamer(twitchUsername, twitchId) {
  if (connectedClients[twitchUsername]) return;

  const user = await prisma.user.findUnique({ where: { twitchId } });
  if (!user || !user.accessToken) return;

  const client = await connectClient(user, twitchUsername);
  if (!client) return;

  console.log('🟢 Connected to chat as:', {
    username: twitchUsername,
    token: `oauth:${user.accessToken}`
  });

  client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const username = tags.username.toLowerCase();
    const command = message.trim().toLowerCase();

    const freshUser = await prisma.user.findUnique({ where: { twitchId } });
    if (!freshUser) return;

    // ✅ Check if giveaway is locked (no new entries allowed)
    if (isGiveawayLocked(freshUser.id)) {
      return; // Ignore new entries
    }

    const expected = freshUser.command.toLowerCase();
    if (command !== expected) return;

    const activeGiveaway = await prisma.giveaway.findFirst({
      where: { userId: freshUser.id, isActive: true }
    });
    if (!activeGiveaway) return;
    
    // ✅ Check if user was previously kicked from this giveaway
    const isKicked = await prisma.kickedUser.findFirst({
      where: {
        giveawayId: activeGiveaway.id,
        username
      }
    });
    if (isKicked) {
      return;
    }

    // ✅ Check for existing entry
    const alreadyEntered = await prisma.entry.findFirst({
      where: {
        giveawayId: activeGiveaway.id,
        username
      }
    });
    if (alreadyEntered) return;

    try {
      await prisma.entry.create({
        data: {
          username,
          twitchId,
          giveawayId: activeGiveaway.id
        }
      });

      const io = getIO();
      const encryptedTwitchId = encrypt(twitchId);
      io.to(encryptedTwitchId).emit('entryUpdate', { entry: username });

      console.log(`${username} entered the giveaway for ${channel}`);
    } catch (err) {
      if (err.code === 'P2002') {
        console.log(`⚠️ Duplicate entry prevented for ${username} in giveaway ${activeGiveaway.id}`);
      } else {
        console.error('❌ Error creating entry:', err);
      }
    }
  });

  connectedClients[twitchUsername] = client;
}

function stopChatListenerForStreamer(twitchUsername) {
  const client = connectedClients[twitchUsername];
  if (client) {
    client.disconnect()
      .then(() => {
        console.log(`🔌 Disconnected chat listener for ${twitchUsername}`);
      })
      .catch(err => {
        console.warn(`⚠️ Failed to disconnect chat listener for ${twitchUsername}: ${err.message}`);
      });
    delete connectedClients[twitchUsername];
  }
}

module.exports = {
  startChatListenerForStreamer,
  stopChatListenerForStreamer,
  lockGiveaway,
  unlockGiveaway
};
