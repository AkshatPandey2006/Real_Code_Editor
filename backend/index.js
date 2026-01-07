import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();
const server = http.createServer(app);

// Self-ping to keep Render awake
const url = `https://real-code-editor-4yx6.onrender.com/`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => console.log(`Reloaded: ${response.status}`))
    .catch((error) => console.error(`Error reloading:`, error.message));
}
setInterval(reloadWebsite, interval);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    // 1. Leave previous room if any
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.has(currentRoom)) {
        const room = rooms.get(currentRoom);
        room.users = room.users.filter((u) => u.socketId !== socket.id);
        io.to(currentRoom).emit("userJoined", room.users);
      }
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    // 2. Initialize room if not exists
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: [],
        currentCode: "// Start coding...",
        currentLanguage: "javascript",
      });
    }

    const room = rooms.get(roomId);
    
    // 3. Add user
    room.users.push({ socketId: socket.id, userName });

    // 4. Send updated user list to everyone
    io.to(roomId).emit("userJoined", room.users);

    // 5. Send the CURRENT code/lang to the NEW user only (Sync on Join)
    socket.emit("codeUpdate", room.currentCode);
    socket.emit("languageUpdate", room.currentLanguage);

    // 6. Notify others
    socket.broadcast.to(roomId).emit("notification", `${userName} joined the room`);
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.currentCode = code; 
    }
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.currentLanguage = language;
    }
    io.to(roomId).emit("languageUpdate", language);
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users = room.users.filter((u) => u.socketId !== socket.id);
      
      io.to(currentRoom).emit("userJoined", room.users);
      socket.broadcast.to(currentRoom).emit("notification", `${currentUser} left the room`);
      
      if (room.users.length === 0) rooms.delete(currentRoom);

      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  socket.on("disconnect", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users = room.users.filter((u) => u.socketId !== socket.id);
      
      io.to(currentRoom).emit("userJoined", room.users);
      socket.broadcast.to(currentRoom).emit("notification", `${currentUser} left`);

      if (room.users.length === 0) rooms.delete(currentRoom);
    }
    console.log("User Disconnected");
  });
});

const port = process.env.PORT || 5000;
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(port, () => {
  console.log("server is working on port 5000");
});
