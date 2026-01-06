import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = "https://real-time-code-9ui2.onrender.com/";
const SOCKET_OPTIONS = {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

const useRoom = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [agenda, setAgenda] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding...");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const s = io(SERVER_URL, SOCKET_OPTIONS);
    setSocket(s);
    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => {
      setIsConnected(false);
      addToast("Connection lost", "error");
    });
    return () => s.disconnect();
  }, [addToast]);

  useEffect(() => {
    if (!socket) return;
    
    // Silent List Update
    socket.on("updateUserList", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    // Specific Join Notification
    socket.on("userJoined", (user) => {
      addToast(`${user} joined the room`, "success");
    });

    // Specific Leave Notification
    socket.on("userLeft", (user) => {
      addToast(`${user} left the room`, "warning");
    });

    socket.on("codeUpdate", (newCode) => setCode(newCode));
    
    socket.on("userTyping", (user) => {
      setTyping(`${user} is typing...`);
      const timer = setTimeout(() => setTyping(""), 2000);
      return () => clearTimeout(timer);
    });

    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
      addToast(`Language changed to ${newLanguage}`, "info");
    });

    return () => {
      socket.off("updateUserList");
      socket.off("userJoined");
      socket.off("userLeft");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
    };
  }, [socket, addToast]);

  const joinRoom = () => {
    if (roomId && userName && socket) {
      socket.emit("join", { roomId, userName, agenda });
      setJoined(true);
    } else {
      addToast("Room ID and Name required", "error");
    }
  };

  const leaveRoom = () => {
    if (socket) socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// Start coding...");
  };

  const updateCode = (newCode) => {
    setCode(newCode);
    if (socket) {
      socket.emit("codeChange", { roomId, code: newCode });
      socket.emit("typing", { roomId, userName });
    }
  };

  const updateLanguage = (newLang) => {
    setLanguage(newLang);
    if (socket) socket.emit("languageChange", { roomId, language: newLang });
  };

  return {
    socket, isConnected, joined, roomId, setRoomId, userName, setUserName,
    agenda, setAgenda, language, code, users, typing, toasts,
    joinRoom, leaveRoom, updateCode, updateLanguage, addToast
  };
};

// --- Icons ---
const Icons = {
  ArrowRight: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
  Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
};

// --- Main App ---
const App = () => {
  const {
    isConnected, joined, roomId, setRoomId, userName, setUserName,
    agenda, setAgenda, language, code, users, typing, toasts,
    joinRoom, leaveRoom, updateCode, updateLanguage, addToast
  } = useRoom();

  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  const resize = useCallback((e) => {
    if (isResizing && e.clientX > 200 && e.clientX < 500) setSidebarWidth(e.clientX);
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", () => setIsResizing(false));
    return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", () => setIsResizing(false)); };
  }, [resize]);

  const generateRoomId = () => setRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
  const copyRoomId = () => { navigator.clipboard.writeText(roomId); addToast("ID Copied", "success"); };

  if (!joined) {
    return (
      <div className="landing-container">
        <div className="grid-background"></div>
        <div className="spotlight"></div>

        <nav className="navbar">
          <div className="nav-content">
            <div className="logo"><span className="logo-glitch">{`</>`}</span> CollabCode</div>
            <div className={`status-pill ${isConnected ? 'online' : 'offline'}`}>
              <div className="dot"></div> {isConnected ? "System Online" : "Connecting..."}
            </div>
          </div>
        </nav>

        <div className="hero-center">
          <div className="glass-panel join-panel fade-in-up">
            <div className="panel-header">
              <h2>Join Workspace</h2>
              <p>Enter a Room ID to collaborate in real-time.</p>
            </div>
            
            <div className="input-group">
              <label>ROOM ID</label>
              <div className="input-with-action">
                <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="e.g. A4X92Z" maxLength={8}/>
                <button onClick={generateRoomId}>Generate</button>
              </div>
            </div>

            <div className="input-group">
              <label>DISPLAY NAME</label>
              <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="John Doe" />
            </div>

            <div className="input-group">
              <label>AGENDA <span className="optional">(OPTIONAL)</span></label>
              <input value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="Interview / Pair Programming" />
            </div>

            <button className="primary-btn" onClick={joinRoom} disabled={!isConnected}>
              {isConnected ? "Launch Editor" : "Connecting..."} <Icons.ArrowRight />
            </button>
          </div>
        </div>
        
        {/* Toasts */}
        <div className="toast-area">
          {toasts.map(t => (
            <div key={t.id} className={`toast-message ${t.type}`}>{t.message}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="grid-background" style={{opacity: 0.1}}></div>
      
      {/* Sidebar */}
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-header">
          <div className="brand-small"><span className="logo-glitch">{`</>`}</span> CollabCode</div>
          <div className="room-info">
             <span className="room-label">ID:</span>
             <span className="room-value">{roomId}</span>
             <button onClick={copyRoomId} className="copy-btn"><Icons.Copy /></button>
          </div>
          <h2 className="agenda-title" title={agenda}>{agenda || "Untitled Session"}</h2>
        </div>

        <div className="users-section">
          <div className="section-title"><Icons.Users /> ONLINE ({users.length})</div>
          <div className="user-list">
            {users.map((u, i) => (
              <div key={i} className="user-item">
                <div className="avatar" style={{background: stringToColor(u)}}>{u[0].toUpperCase()}</div>
                <span className="name">{u}</span>
                <div className="status-dot-active"></div>
              </div>
            ))}
          </div>
        </div>

        <button className="disconnect-btn" onClick={leaveRoom}>Disconnect</button>
      </div>

      <div className="resizer" onMouseDown={() => setIsResizing(true)}></div>

      {/* Main Editor Area */}
      <div className="main-content">
        <div className="toolbar">
          <div className="toolbar-left">
            <select className="lang-select" value={language} onChange={e => updateLanguage(e.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>
          <div className="toolbar-right">
            {typing && <div className="typing-indicator">{typing}</div>}
            <div className="live-badge"><div className="pulse-dot"></div> LIVE</div>
          </div>
        </div>

        <div className="editor-wrapper">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={updateCode}
            theme="vs-dark"
            options={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 14,
              minimap: { enabled: false },
              padding: { top: 24 },
              scrollBeyondLastLine: false,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: true,
              smoothScrolling: true,
            }}
          />
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-item">Spaces: 2</div>
          <div className="status-item">UTF-8</div>
          <div className="status-item">{language.toUpperCase()}</div>
          <div className="status-item right">⚡ Connected</div>
        </div>
      </div>

      <div className="toast-area">
        {toasts.map(t => (
          <div key={t.id} className={`toast-message ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
};

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

export default App;
