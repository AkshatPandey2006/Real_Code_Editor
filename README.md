<div align="center">

# ⚡ CollabCode
### Real-Time Collaborative Development Environment

[![Live Demo](https://img.shields.io/badge/Demo-Live_App-2ea44f?style=for-the-badge&logo=render)](https://real-time-code-9ui2.onrender.com/)
[![GitHub License](https://img.shields.io/github/license/AkshatPandey2006/Real_Code_Editor?style=for-the-badge&color=blue)](https://github.com/AkshatPandey2006/Real_Code_Editor/blob/main/LICENSE)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Node](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Sync-Socket.io-010101?style=for-the-badge&logo=socket.io)](https://socket.io/)

<p align="center">
  <b>Synchronized Coding. Instant Execution. Ephemeral Workspaces.</b><br />
  <i>Engineered for technical interviews, pair programming, and competitive coding practice.</i>
</p>

</div>

---

## 📖 Overview

**CollabCode** is a high-performance, WebSocket-based code editor that enables multiple developers to write, edit, and execute code simultaneously in a shared environment. 

Designed with a **"Zero Friction"** philosophy, it requires no user authentication—rooms are generated instantly and are fully ephemeral. The system leverages an in-memory state management approach to achieve **sub-30ms latency**, ensuring a seamless "local-feel" development experience.

---

## 📸 Interface

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./1.png" alt="Landing Page" width="100%"/>
      <br />
      <b>Streamlined Entry</b>
    </td>
    <td align="center" width="50%">
      <img src="./2.png" alt="Editor View" width="100%"/>
      <br />
      <b>Collaborative Workspace</b>
    </td>
  </tr>
</table>

---

## ✨ Core Features

* **⚡ Low-Latency Sync:** Broadcasts operational transforms via **Socket.io** to sync code state across clients in real-time.
* **💻 Remote Code Execution:** Integrated **Piston API** sandbox to compile and execute JavaScript, Python, Java, and C++ securely.
* **🎨 Monaco Editor Engine:** Leveraging the power of VS Code's core editor for IntelliSense, syntax highlighting, and minimaps.
* **📐 Dynamic Layout:** Fully resizable sidebar and terminal panels (Horizontal & Vertical resizing) to customize the development environment.
* **👥 Live Presence:** Real-time visibility of active users, typing indicators, and connection lifecycles.
* **🛡️ Privacy by Design:** In-memory storage ensures data is wiped instantly upon session termination.

---

## 🏗️ System Architecture

The application follows a **Client-Server Event-Driven Architecture**. 

```mermaid
graph TD
    UserA[User A (Client)] <-->|WebSocket| Server[Node.js Server]
    UserB[User B (Client)] <-->|WebSocket| Server
    Server <-->|HTTP POST| Compiler[Piston API Sandbox]
    
    subgraph "Server Logic"
    SocketHandler[Socket Handler]
    RoomManager[In-Memory Room Map]
    end
    
    Server --- SocketHandler
    SocketHandler --- RoomManager
