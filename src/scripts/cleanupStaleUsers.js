const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanInactiveUsers() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

  const deleted = await prisma.user.deleteMany({
    where: {
      lastLoginAt: { lt: cutoff }
    }
  });

  console.log(`🧹 Removed ${deleted.count} inactive users.`);
  await prisma.$disconnect();
}

cleanInactiveUsers().catch(err => {
  console.error('Error cleaning users:', err);
  prisma.$disconnect();
});
