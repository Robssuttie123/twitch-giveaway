const app = require('./app');
const http = require('http');
const { initIO } = require('./socket'); 

const server = http.createServer(app);
initIO(server); // << initialize socket.io once


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

require('./tasks/cleanupOldGiveaways');