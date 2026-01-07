# ⚡ CollabCode  
### Real-Time Collaborative Development Environment

[![Live Demo](https://img.shields.io/badge/Demo-Live_App-2ea44f?style=for-the-badge&logo=render)](https://real-code-editor-4yx6.onrender.com/)
[![License](https://img.shields.io/github/license/AkshatPandey2006/Real_Code_Editor?style=for-the-badge&color=blue)](./LICENSE)
[![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Backend](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Realtime](https://img.shields.io/badge/Realtime-Socket.io-010101?style=for-the-badge&logo=socket.io)](https://socket.io/)

**Synchronized Coding · Instant Execution · Ephemeral Workspaces**  
*Built for technical interviews, pair programming, and competitive coding.*

---

## 📖 Overview

**CollabCode** is a high-performance, WebSocket-based collaborative code editor that enables multiple developers to **write, edit, and execute code simultaneously** in a shared workspace.

The platform follows a **Zero-Friction philosophy**:
- No authentication
- Instant room creation
- Fully ephemeral sessions

To achieve a smooth, local-like experience, CollabCode uses **in-memory state management** and **WebSocket-based synchronization**, delivering **sub-30ms latency** across connected clients.

---

## 📸 Interface Preview

### Landing Page
![Landing Page](./1.png)

### Collaborative Workspace
![Editor View](./2.png)

---

## ✨ Core Features

- ⚡ **Low-Latency Real-Time Sync**  
  Character-level synchronization using **Socket.io**.

- 💻 **Secure Remote Code Execution**  
  Integrated **Piston API** sandbox supporting:
  - JavaScript
  - Python
  - Java
  - C++

- 🎨 **Monaco Editor (VS Code Engine)**  
  Provides IntelliSense, syntax highlighting, and minimap support.

- 📐 **Dynamic & Resizable Layout**  
  Adjustable editor, terminal, and sidebar panels (horizontal & vertical resizing).

- 👥 **Live Presence Awareness**  
  Real-time user join/leave updates and session visibility.

- 🛡️ **Privacy by Design**  
  All session data is stored **in memory** and destroyed immediately when the room ends.

---

Engineering Decisions

WebSockets over HTTP Polling
Enables full-duplex, low-latency communication for real-time collaboration.

In-Memory Map vs Redis
Eliminates network overhead and complexity for ephemeral rooms.

Last-Write-Wins (LWW) Strategy
Simplifies concurrency management without CRDT/OT overhead for small sessions.

📂 Project Structure

Real_Code_Editor/
├── .github/                # GitHub workflows
├── backend/                # Node.js backend
│   └── index.js            # Socket.io server entry
├── frontend/               # React client
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── assets/         # Icons & images
│   │   ├── App.css         # Global styles
│   │   ├── App.jsx         # Main component
│   │   └── main.jsx        # React entry
│   ├── vite.config.js      # Vite config
│   └── package.json
├── 1.png                   # Landing preview
├── 2.png                   # Editor preview
├── package.json            # Root dependencies
└── README.md

🚀 Getting Started
Prerequisites

Node.js v14+

npm or yarn

Installation

Clone the repository:

git clone https://github.com/AkshatPandey2006/Real_Code_Editor.git
cd Real_Code_Editor


Install dependencies:

npm install
cd frontend
npm install
cd ..

Run Locally

This command starts:

Backend on http://localhost:5000

Frontend on http://localhost:5173

npm run dev


Open in browser:

http://localhost:5173

🔌 Socket API Reference
Event Name	Direction	Payload	Description
join	Client → Server	{ roomId, userName }	Join a room
codeChange	Bidirectional	{ roomId, code }	Sync code
syncCode	Server → Client	{ code }	Send room state
leaveRoom	Client → Server	null	Leave room
🤝 Contributing

Contributions are welcome.

Fork the repository

Create a feature branch

git checkout -b feature/YourFeature


Commit your changes

git commit -m "Add YourFeature"


Push to the branch

git push origin feature/YourFeature


Open a Pull Request

📄 License

This project is licensed under the MIT License.
See the LICENSE
 file for details.

Built with ❤️ by Akshat Pandey
LinkedIn: https://www.linkedin.com/in/akshatpandey2006/
