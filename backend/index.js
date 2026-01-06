import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from 'axios';

const app = express();
const server = http.createServer(app);

// Keep your self-ping logic
const url = `https://realtime-code-editor-zwp3.onrender.com`;
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
    // 1. Leave previous room if any
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(currentUser);
        // FIX 1: Send 'updateUserList' to the old room
        io.to(currentRoom).emit("updateUserList", Array.from(rooms.get(currentRoom)));
      }
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);

    // FIX 2: Send 'updateUserList' with the array (for the sidebar)
    io.to(roomId).emit("updateUserList", Array.from(rooms.get(roomId)));
    
    // FIX 3: Send 'userJoined' with the name (for the toast notification)
    socket.to(roomId).emit("userJoined", userName);
  });

  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      
      // FIX 4: Correct events on leave
      socket.to(currentRoom).emit("userLeft", currentUser);
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
      
      // FIX 5: Correct events on disconnect
      socket.to(currentRoom).emit("userLeft", currentUser);
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
