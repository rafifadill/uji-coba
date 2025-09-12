const socketio = require('socket.io');
let io;
module.exports = {
  init: (server) => {
    io = socketio(server, {
      cors: {
        origin: "http://localhost:3001", // ganti sesuai frontend
        methods: ["GET", "POST"]
      }
    });
    return io;
  },
  getIO: () => {
    if (!io) throw new Error('Socket.io not initialized!');
    return io;
  },
  io // export io for direct use
};