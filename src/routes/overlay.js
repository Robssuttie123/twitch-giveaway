const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('../utils/crypto');

// Overlay page render
router.get('/overlay/:encryptedId', async (req, res) => {
  const { encryptedId } = req.params;
  try {
    const twitchId = decrypt(encryptedId);

    if (!twitchId || typeof twitchId !== 'string') {
      throw new Error('Decryption returned invalid ID');
    }

    res.render('overlay', {
      twitchId: encryptedId // still encrypted for socket room
    });
  } catch (err) {
    console.error(`❌ Failed to decrypt overlay ID (${encryptedId}):`, err.message);
    res.status(400).send("Invalid overlay URL.");
  }
});

// Overlay entries API
router.get('/api/overlay/:encryptedId/entries', async (req, res) => {
  try {
    const encryptedId = req.params.encryptedId;
    if (!encryptedId || encryptedId.length < 8) throw new Error('Too short');

    const twitchId = decrypt(encryptedId);

    const activeGiveaway = await prisma.giveaway.findFirst({
      where: {
        user: {
          twitchId
        },
        isActive: true
      },
      include: {
        entries: true
      }
    });

    if (!activeGiveaway) {
      return res.json({ entries: [], command: null });
    }

    res.json({
      entries: activeGiveaway.entries.map(e => e.username),
      command: activeGiveaway.command
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn("❌ Failed to decrypt overlay API request:", req.params.encryptedId, '->', err.message);
    }
    res.status(400).json({ entries: [], command: null });
  }
});

module.exports = router;
