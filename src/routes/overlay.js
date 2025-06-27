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
      twitchId: req.params.encryptedId // <- stay encrypted for Socket.IO room
    });
  } catch (err) {
    console.error("❌ Invalid overlay ID");
    res.status(400).send("Invalid overlay URL.");
  }
});

// API route for fetching current entries using encrypted ID
router.get('/api/overlay/:encryptedId/entries', async (req, res) => {
  try {
    const twitchId = decrypt(req.params.encryptedId);

    const activeGiveaway = await prisma.giveaway.findFirst({
      where: {
        user: {
          twitchId
        },
        isActive: true
      },
      include: { entries: true }
    });

    if (!activeGiveaway) {
      return res.json({ entries: [] });
    }

    res.json({
      entries: activeGiveaway.entries.map(e => e.username)
    });
  } catch (err) {
    console.error("❌ Failed to decrypt overlay API request");
    res.status(400).json({ entries: [] });
  }
});

module.exports = router;
