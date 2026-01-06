import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

// --- constants ---
const SERVER_URL = "https://real-time-code-9ui2.onrender.com/";
const SOCKET_OPTIONS = {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

// --- Custom Hook: useRoom (Logic) ---
const useRoom = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [agenda, setAgenda] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
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
      addToast("A new user joined the room", "success");
    });
    socket.on("codeUpdate", (newCode) => setCode(newCode));
    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 10)}... is typing`);
      const timer = setTimeout(() => setTyping(""), 2000);
      return () => clearTimeout(timer);
    });
    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
      addToast(`Language changed to ${newLanguage}`, "info");
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
      addToast("Joined room successfully", "success");
    } else {
      addToast("Please enter Room ID and Name", "error");
    }
  };

  const leaveRoom = () => {
    if (socket) socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setAgenda("");
    setCode("// start code here");
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

  const emitCursorPosition = (position) => {
    if (socket) socket.emit("cursorChange", { roomId, userName, position });
  };

  return {
    socket, isConnected, joined, roomId, setRoomId, userName, setUserName,
    agenda, setAgenda, language, code, users, typing, toasts,
    joinRoom, leaveRoom, updateCode, updateLanguage, emitCursorPosition, addToast
  };
};

// --- Helper Component: ScrollReveal ---
// Adds a "fade-in-up" animation when elements scroll into view
const ScrollReveal = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${isVisible ? "active" : ""}`}>
      {children}
    </div>
  );
};

// --- Main Component ---
const App = () => {
  const roomData = useRoom();
  const {
    isConnected, joined, roomId, setRoomId, userName, setUserName,
    agenda, setAgenda, language, code, users, typing, toasts,
    joinRoom, leaveRoom, updateCode, updateLanguage, emitCursorPosition, addToast
  } = roomData;

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  // Resize Logic
  const startResizing = () => setIsResizing(true);
  const stopResizing = () => setIsResizing(false);
  const resize = useCallback((e) => {
    if (isResizing && e.clientX > 200 && e.clientX < 600) {
      setSidebarWidth(e.clientX);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    addToast("Room ID copied to clipboard", "success");
  };

  const generateRoomId = () => {
    setRoomId(Math.random().toString(36).substring(2, 9));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- RENDER: LANDING PAGE ---
  if (!joined) {
    return (
      <div className="landing-page">
        <div className="ambient-light"></div>
        
        {/* Navigation */}
        <nav className="navbar">
          <div className="nav-container">
            <div className="nav-logo">
              <span className="logo-icon">{`</>`}</span> Collab Code
            </div>
            <div className="nav-links">
              <a href="#how-it-works">How it works</a>
              <a href="#features">Features</a>
              <a href="https://github.com/AkshatPandey2006" target="_blank" rel="noreferrer">
                <svg height="20" viewBox="0 0 16 16" version="1.1" width="20" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
              </a>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <div className="badge">v2.0 Now Live</div>
            <h1>Real-time collaboration for <br /><span className="text-gradient">modern developers.</span></h1>
            <p className="hero-subtitle">
              Instant code synchronization, syntax highlighting for 4+ languages, and a distraction-free environment. 
              Open source and ready for your next interview or hackathon.
            </p>
            
            <div className="stats-row">
              <div className="stat">
                <span className="stat-val">0ms</span>
                <span className="stat-label">Latency</span>
              </div>
              <div className="stat">
                <span className="stat-val">100%</span>
                <span className="stat-label">Free</span>
              </div>
              <div className="stat">
                <span className="stat-val">4+</span>
                <span className="stat-label">Langs</span>
              </div>
            </div>
          </div>

          {/* Join Card */}
          <div className="join-card-wrapper">
            <div className="join-card">
              <div className="card-header">
                <h2>Start Coding</h2>
                <div className={`status-dot ${isConnected ? "online" : "offline"}`} 
                     title={isConnected ? "Server Online" : "Connecting..."}></div>
              </div>
              
              <div className="input-group">
                <div className="room-id-wrapper">
                  <input
                    type="text"
                    placeholder="Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    onKeyUp={(e) => e.key === "Enter" && joinRoom()}
                  />
                  <button className="btn-generate" onClick={generateRoomId}>Generate</button>
                </div>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyUp={(e) => e.key === "Enter" && joinRoom()}
                />
                <input
                  type="text"
                  placeholder="Agenda (Optional)"
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  onKeyUp={(e) => e.key === "Enter" && joinRoom()}
                />
              </div>
              <button onClick={joinRoom} className="btn-join" disabled={!isConnected}>
                {isConnected ? "Join Room" : "Connecting..."}
              </button>
            </div>
            {/* Decoration behind card */}
            <div className="card-decoration"></div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="section-padding">
          <div className="section-header">
            <h2>Everything you need</h2>
            <p>Built for speed, reliability, and developer experience.</p>
          </div>
          
          <div className="features-grid">
            <ScrollReveal>
              <div className="feature-card">
                <div className="icon-box">⚡</div>
                <h3>Lightning Fast Sync</h3>
                <p>Powered by Socket.io, changes are broadcasted in milliseconds. No refresh needed.</p>
              </div>
            </ScrollReveal>
            
            <ScrollReveal>
              <div className="feature-card">
                <div className="icon-box">🎨</div>
                <h3>Monaco Editor</h3>
                <p>The full power of VS Code in your browser. IntelliSense, minimap, and formatting.</p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="feature-card">
                <div className="icon-box">🛡️</div>
                <h3>Private Rooms</h3>
                <p>Generate a unique room ID and share it only with the people you want to collaborate with.</p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="feature-card">
                <div className="icon-box">👥</div>
                <h3>Live Presence</h3>
                <p>See who is online, who is typing, and track active users in the sidebar.</p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="section-padding alt-bg">
          <div className="section-header">
            <h2>How it works</h2>
            <p>Get started in less than 10 seconds.</p>
          </div>

          <div className="steps-container">
            <ScrollReveal>
              <div className="step-item">
                <div className="step-number">01</div>
                <h3>Create a Room</h3>
                <p>Click "Generate" to create a unique Room ID or enter a custom one.</p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="step-item">
                <div className="step-number">02</div>
                <h3>Share the ID</h3>
                <p>Copy the ID and send it to your friends or teammates.</p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="step-item">
                <div className="step-number">03</div>
                <h3>Start Coding</h3>
                <p>Everyone joins the room and starts editing the same file instantly.</p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="cta-section">
          <ScrollReveal>
            <div className="cta-content">
              <h2>Ready to collaborate?</h2>
              <p>No account required. Open source. Free forever.</p>
              <button className="btn-large" onClick={scrollToTop}>Start Coding Now</button>
            </div>
          </ScrollReveal>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-col">
              <h4>Collab Code</h4>
              <p>Real-time collaboration made simple.</p>
            </div>
            <div className="footer-col">
              <h4>Links</h4>
              <a href="https://github.com/AkshatPandey2006" target="_blank" rel="noreferrer">GitHub</a>
              <a href="#features">Features</a>
              <a href="#how-it-works">How-to</a>
            </div>
            <div className="footer-col">
              <h4>Connect</h4>
              <a href="https://github.com/AkshatPandey2006" target="_blank" rel="noreferrer">
                 Follow @AkshatPandey2006
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Collab Code. Built with ❤️ by <a href="https://github.com/AkshatPandey2006" target="_blank" rel="noreferrer" className="author-link">Akshat Pandey</a>.</p>
          </div>
        </footer>

        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- RENDER: EDITOR (Authenticated) ---
  return (
    <div className="editor-container">
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-header">
          <div className="agenda-box">
             <h2 title={agenda}>{agenda || "Untitled Room"}</h2>
             <div className="connection-status">
               <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
               {isConnected ? "Live" : "Offline"}
             </div>
          </div>
          
          <div className="room-id-box">
            <span>ID: {roomId}</span>
            <button onClick={copyRoomId} className="copy-btn" title="Copy ID">📋</button>
          </div>
        </div>

        <div className="users-list">
          <h3>Active Users ({users.length})</h3>
          <ul>
            {users.map((user, index) => (
              <li key={index} className="user-item">
                <span className="avatar" style={{ backgroundColor: stringToColor(user) }}>
                  {user.charAt(0).toUpperCase()}
                </span>
                <span className="username" title={user}>{user}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-footer">
          <button className="leave-btn" onClick={leaveRoom}>Leave Room</button>
        </div>
      </div>

      <div className="resizer" onMouseDown={startResizing} />

      <div className="main-area">
        <div className="toolbar">
          <div className="left-tools">
            <select className="lang-select" value={language} onChange={(e) => updateLanguage(e.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>
          <div className="right-tools">
            {typing && <span className="typing-indicator">{typing}</span>}
          </div>
        </div>

        <div className="editor-wrapper">
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            value={code}
            onChange={updateCode}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "Fira Code, monospace",
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: true,
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>
      </div>

      <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
    </div>
  );
};

// Helper
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

export default App;
