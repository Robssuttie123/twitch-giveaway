let io = null;

function initIO(server) {
  const { Server } = require('socket.io');
  io = new Server(server);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  io.on('connection', (socket) => {
    console.log('🟢 New socket connected');

    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
      console.log('🟣 Socket joined room', roomId);
    });

    socket.on('requestCurrentEntries', async (twitchId) => {
      try {
		const latestGiveaway = await prisma.giveaway.findFirst({
		  where: { userId: req.user.id },
		  orderBy: { createdAt: 'desc' },
		  include: { entries: true }
		});

        if (latestGiveaway && latestGiveaway.entries) {
          const usernames = latestGiveaway.entries.map(e => e.username);
          socket.emit('currentEntries', usernames);
        } else {
          socket.emit('currentEntries', []);
        }
      } catch (err) {
        console.error('Error fetching current entries:', err);
        socket.emit('currentEntries', []);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔴 Socket disconnected');
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

module.exports = { initIO, getIO };
