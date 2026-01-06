import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = "https://real-time-code-9ui2.onrender.com/";
const SOCKET_OPTIONS = {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

// --- Custom Hook (Logic Layer) ---
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
      addToast("Disconnected from server", "error");
    });
    return () => s.disconnect();
  }, [addToast]);

  useEffect(() => {
    if (!socket) return;
    socket.on("userJoined", (updatedUsers) => {
      setUsers(updatedUsers);
      addToast("New user connected", "success");
    });
    socket.on("codeUpdate", (newCode) => setCode(newCode));
    socket.on("userTyping", (user) => {
      setTyping(`${user} is typing...`);
      const timer = setTimeout(() => setTyping(""), 2000);
      return () => clearTimeout(timer);
    });
    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
      addToast(`Language: ${newLanguage}`, "info");
    });
    return () => {
      socket.off("userJoined");
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

// --- Animations ---
const FadeIn = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { threshold: 0.2 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`fade-in ${isVisible ? "visible" : ""}`}>
      {children}
    </div>
  );
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

  const generateRoomId = () => setRoomId(Math.random().toString(36).substring(2, 9).toUpperCase());
  const copyRoomId = () => { navigator.clipboard.writeText(roomId); addToast("ID Copied", "success"); };

  // --- LANDING PAGE ---
  if (!joined) {
    return (
      <div className="landing-container">
        <div className="grid-background"></div>
        <div className="spotlight"></div>

        <nav className="navbar">
          <div className="nav-content">
            <div className="logo">
              <div className="logo-square"></div> CollabCode
            </div>
            <div className="nav-actions">
              <a href="https://github.com/AkshatPandey2006" target="_blank" className="nav-link">GitHub</a>
              <div className={`status-pill ${isConnected ? 'online' : 'offline'}`}>
                <div className="dot"></div> {isConnected ? "System Optimal" : "Reconnecting"}
              </div>
            </div>
          </div>
        </nav>

        <section className="hero">
          <FadeIn>
            <div className="hero-badge">New: Real-time Cursor Sync v2.0</div>
            <h1 className="hero-title">
              Code and discuss <br /> instantly <span className="gradient-text">together.</span>
            </h1>
            <p className="hero-sub">
              Zero-latency collaboration environment. No sign-up. <br/> 
              Just generate a room and start collaborating.
            </p>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="glass-panel join-panel">
              <div className="panel-glow"></div>
              <div className="panel-content">
                <div className="input-row">
                  <div className="input-wrapper grow">
                    <label>ROOM ID</label>
                    <div className="input-with-action">
                      <input 
                        value={roomId} 
                        onChange={e => setRoomId(e.target.value)} 
                        placeholder="Ex. X7K9P2" 
                        maxLength={10}
                      />
                      <button onClick={generateRoomId} className="action-btn">Generate</button>
                    </div>
                  </div>
                  <div className="input-wrapper grow">
                    <label>USERNAME</label>
                    <input 
                      value={userName} 
                      onChange={e => setUserName(e.target.value)} 
                      placeholder="Display Name" 
                    />
                  </div>
                </div>
                <div className="input-wrapper">
                  <label>AGENDA (OPTIONAL)</label>
                  <input 
                    value={agenda} 
                    onChange={e => setAgenda(e.target.value)} 
                    placeholder="e.g. System Design Interview" 
                  />
                </div>
                <button className="primary-btn" onClick={joinRoom} disabled={!isConnected}>
                  {isConnected ? "Enter Workspace" : "Establishing Connection..."} <span className="arrow">→</span>
                </button>
              </div>
            </div>
          </FadeIn>
        </section>

        <section className="features">
          <div className="section-title">
            <h2>Engineered for performance</h2>
          </div>
          <div className="bento-grid">
            <FadeIn delay={100}>
              <div className="bento-card card-1">
                <div className="card-icon">⚡</div>
                <h3>Instant Sync</h3>
                <p>WebSocket architecture ensures <span className="highlight">sub-30ms latency</span> anywhere in the world.</p>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="bento-card card-2">
                <div className="card-icon">🛡️</div>
                <h3>Secure by Default</h3>
                <p>Ephemeral rooms. Data is wiped from memory as soon as the last user leaves.</p>
              </div>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="bento-card card-3">
                <div className="card-icon">💻</div>
                <h3>Pro Environment</h3>
                <p>Monaco Editor implementation with full syntax highlighting and IntelliSense.</p>
              </div>
            </FadeIn>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-line"></div>
          <div className="footer-content">
            <span>© 2026 CollabCode Inc.</span>
            <a href="https://github.com/AkshatPandey2006" target="_blank">Built by Akshat Pandey</a>
          </div>
        </footer>

        {/* Toasts */}
        <div className="toast-area">
          {toasts.map(t => (
            <div key={t.id} className={`toast-message ${t.type}`}>{t.message}</div>
          ))}
        </div>
      </div>
    );
  }

  // --- APP EDITOR ---
  return (
    <div className="app-container">
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-header">
          <h2 title={agenda}>{agenda || "Untitled Room"}</h2>
          <div className="room-meta">
            <span className="room-id">{roomId}</span>
            <button onClick={copyRoomId} className="icon-btn" title="Copy">❐</button>
          </div>
        </div>

        <div className="user-section">
          <div className="section-label">ONLINE — {users.length}</div>
          {users.map((u, i) => (
            <div key={i} className="user-row">
              <div className="user-avatar" style={{background: stringToColor(u)}}>{u[0].toUpperCase()}</div>
              <span className="user-name">{u}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="danger-btn" onClick={leaveRoom}>Disconnect</button>
        </div>
      </div>

      <div className="resizer" onMouseDown={() => setIsResizing(true)}></div>

      <div className="editor-area">
        <div className="toolbar">
          <div className="toolbar-left">
            <select value={language} onChange={e => updateLanguage(e.target.value)} className="lang-select">
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>
          <div className="toolbar-right">
             {typing && <span className="typing-status">{typing}</span>}
             <div className="live-dot"></div>
          </div>
        </div>
        <Editor
          height="calc(100vh - 50px)"
          language={language}
          value={code}
          onChange={updateCode}
          theme="vs-dark"
          options={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 14,
            minimap: { enabled: false },
            padding: { top: 20 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
          }}
        />
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
