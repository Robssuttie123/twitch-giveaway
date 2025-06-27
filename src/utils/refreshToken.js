const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function refreshAccessToken(user) {
  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET
      }
    });

    const { access_token, refresh_token } = response.data;

    // Save new tokens to DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token || user.refreshToken // fallback
      }
    });

    return access_token;
  } catch (err) {
    console.error("❌ Failed to refresh Twitch token:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { refreshAccessToken };
