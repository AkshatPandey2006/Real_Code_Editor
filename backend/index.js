import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from 'axios';

const app = express();
const server = http.createServer(app);

// Keep the self-ping to prevent sleep on Render free tier
const url = `https://realtime-code-editor-zwp3.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log(`Reloaded at ${new Date().toISOString()}: Status Code ${response.status}`);
    })
    .catch((error) => {
      console.error(`Error reloading at ${new Date().toISOString()}:`, error.message);
    });
}

setInterval(reloadWebsite, interval);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Store room state
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    // 1. Handle user switching rooms (cleanup old room)
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(currentUser);
        io.to(currentRoom).emit("updateUserList", Array.from(rooms.get(currentRoom)));
      }
    }

    // 2. Join new room
    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);

    // 3. BROADCAST UPDATES (The Fix)
    // Send the full list of users to update the sidebar count
    io.to(roomId).emit("updateUserList", Array.from(rooms.get(roomId)));
    
    // Send a specific notification that someone joined (for the green toast)
    socket.broadcast.to(roomId).emit("userJoined", userName);
  });

  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      
      // Notify others that user left
      socket.to(currentRoom).emit("userLeft", currentUser);
      
      // Update the list for everyone remaining
      io.to(currentRoom).emit("updateUserList", Array.from(rooms.get(currentRoom)));

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
      
      // Notify others
      socket.to(currentRoom).emit("userLeft", currentUser);
      
      // Update list
      io.to(currentRoom).emit("updateUserList", Array.from(rooms.get(currentRoom)));
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
