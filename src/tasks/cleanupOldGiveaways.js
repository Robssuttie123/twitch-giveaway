const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

cron.schedule('0 0 * * *', async () => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1); // 1 day ago

    const oldGiveaways = await prisma.giveaway.findMany({
      where: {
        createdAt: { lt: cutoff },
        isActive: false
      },
      select: { id: true }
    });

    if (oldGiveaways.length === 0) {
      console.log("🧹 No old giveaways to clean up.");
      return;
    }

    const oldIds = oldGiveaways.map(g => g.id);

    // Delete entries first (foreign key constraint)
    await prisma.entry.deleteMany({
      where: { giveawayId: { in: oldIds } }
    });

    // Then delete the giveaways
    await prisma.giveaway.deleteMany({
      where: { id: { in: oldIds } }
    });

    console.log(`🧼 Cleaned up ${oldIds.length} old giveaways.`);
  } catch (err) {
    console.error("❌ Cleanup task failed:", err);
  }
});
