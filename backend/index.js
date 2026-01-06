import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from 'axios';

const app = express();
const server = http.createServer(app);

// Self-ping to keep Render awake
const url = `https://real-code-editor-4yx6.onrender.com/`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log(`Reloaded: ${response.status}`);
    })
    .catch((error) => {
      console.error(`Error reloading:`, error.message);
    });
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
    // 1. Leave previous room
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(currentUser);
        // Sync list for old room
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      }
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);

    // FIX: Send the LIST using 'userJoined' (Matching the similar project logic)
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
    
    // Send a separate 'notification' event for the toast
    socket.broadcast.to(roomId).emit("notification", `${userName} joined the room`);
  });

  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      
      // FIX: Update list on leave
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      socket.broadcast.to(currentRoom).emit("notification", `${currentUser} left the room`);

      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  socket.on("disconnect", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);
      
      // FIX: Update list on disconnect
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      socket.broadcast.to(currentRoom).emit("notification", `${currentUser} left`);
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
