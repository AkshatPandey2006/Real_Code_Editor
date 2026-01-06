const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  // Map socket IDs to user names
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        userName: userSocketMap[socketId],
      };
    }
  );
}

io.on("connection", (socket) => {
  // 1. JOIN ROOM
  socket.on("join", ({ roomId, userName }) => {
    userSocketMap[socket.id] = userName;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    const userNames = clients.map((client) => client.userName);
    
    // Broadcast the updated list to EVERYONE in the room (including the new joiner)
    io.to(roomId).emit("updateUserList", userNames);
    
    // Notify others
    socket.to(roomId).emit("userJoined", userName);
    
    console.log(`${userName} joined room: ${roomId}`);
  });

  // 2. CODE CHANGE
  socket.on("codeChange", ({ roomId, code }) => {
    socket.in(roomId).emit("codeUpdate", code);
  });

  // 3. TYPING
  socket.on("typing", ({ roomId, userName }) => {
    socket.in(roomId).emit("userTyping", userName);
  });

  // 4. LANGUAGE
  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // 5. DISCONNECT
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      // Notify user left
      socket.in(roomId).emit("userLeft", userSocketMap[socket.id]);
      
      // We must remove the user from the map slightly delayed or handle the list filter
      // Actually, filtering the 'clients' list is safer:
      const clients = getAllConnectedClients(roomId);
      // Filter out the disconnecting user
      const remainingUsers = clients
        .filter(client => client.socketId !== socket.id)
        .map(client => client.userName);
        
      io.to(roomId).emit("updateUserList", remainingUsers);
    });
    
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
