const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('../utils/crypto');

// Route to render the overlay using encrypted ID
router.get('/overlay/:encryptedId', async (req, res) => {
  try {
    const twitchId = decrypt(req.params.encryptedId);
    res.render('overlay', {
      twitchId: req.params.encryptedId // still encrypted for socket room
    });
  } catch (err) {
    console.error("❌ Invalid overlay ID");
    res.status(400).send("Invalid overlay URL.");
  }
});

// API route for fetching current entries + command using encrypted ID
router.get('/api/overlay/:encryptedId/entries', async (req, res) => {
  try {
    const twitchId = decrypt(req.params.encryptedId);

    const user = await prisma.user.findUnique({
      where: { twitchId },
      include: {
        giveaways: {
          where: { isActive: true },
          include: { entries: true }
        }
      }
    });

    if (!user || !user.giveaways.length) {
      return res.json({ entries: [], command: '!' });
    }

    const activeGiveaway = user.giveaways[0];
    const command = user.command || '!';

    res.json({
      entries: activeGiveaway.entries.map(e => e.username),
      command
    });
  } catch (err) {
    console.error("❌ Failed to decrypt overlay API request");
    res.status(400).json({ entries: [], command: '!' });
  }
});

module.exports = router;
