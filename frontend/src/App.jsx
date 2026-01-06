import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = "https://real-time-code-9ui2.onrender.com/";
const SOCKET_OPTIONS = {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

// --- Custom Hook (Logic) ---
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

// --- Components ---
const FadeIn = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`fade-in ${isVisible ? "visible" : ""}`}>
      {children}
    </div>
  );
};

const AccordionItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`faq-item ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
      <div className="faq-question">
        {question}
        <span className="faq-icon">{isOpen ? '−' : '+'}</span>
      </div>
      <div className="faq-answer">{answer}</div>
    </div>
  );
};

const Icons = {
  Lightning: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  Shield: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Code: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>,
  ArrowRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
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
              <span className="logo-icon">{`</>`}</span> CollabCode
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
            <div className="hero-badge">
              <span className="badge-dot"></span> v2.0 Now Available
            </div>
            <h1 className="hero-title">
              Code at the <br /> speed of <span className="gradient-text">thought.</span>
            </h1>
            <p className="hero-sub">
              A high-performance, real-time collaborative environment. <br/> 
              Engineered for speed. Secured by design.
            </p>
          </FadeIn>

          <FadeIn delay={200}>
            {/* The Blue Glass Panel */}
            <div className="glass-panel join-panel">
              <div className="panel-glow-effect"></div>
              <div className="panel-content">
                <div className="input-row">
                  <div className="input-wrapper grow">
                    <label>ROOM ID</label>
                    <div className="input-with-action">
                      <input 
                        value={roomId} 
                        onChange={e => setRoomId(e.target.value)} 
                        placeholder="ID..." 
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
                      placeholder="Name..." 
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
                  {isConnected ? "Initialize Workspace" : "Connecting..."} <Icons.ArrowRight />
                </button>
              </div>
            </div>
          </FadeIn>
        </section>

        <section className="features">
          <div className="section-header">
            <h2>Workflow Optimized</h2>
            <p>Built on WebSockets for real-time bi-directional communication.</p>
          </div>
          <div className="bento-grid">
            <FadeIn delay={100}>
              <div className="bento-card">
                <div className="card-icon"><Icons.Lightning /></div>
                <h3>Instant Sync</h3>
                <p>Changes broadcasted in <span className="highlight">sub-30ms</span>. Feels like local development.</p>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="bento-card">
                <div className="card-icon"><Icons.Shield /></div>
                <h3>Secure by Default</h3>
                <p>Rooms are ephemeral. Data is wiped from memory instantly when the session ends.</p>
              </div>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="bento-card">
                <div className="card-icon"><Icons.Code /></div>
                <h3>Monaco Engine</h3>
                <p>The same editor that powers VS Code. Full IntelliSense and syntax highlighting.</p>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="how-it-works">
          <div className="section-header">
            <h2>How it works</h2>
          </div>
          <div className="steps-wrapper">
            <FadeIn delay={100}>
              <div className="step-card">
                <div className="step-number">01</div>
                <h3>Create</h3>
                <p>Generate a secure Room ID.</p>
              </div>
            </FadeIn>
            <div className="step-connector"></div>
            <FadeIn delay={200}>
              <div className="step-card">
                <div className="step-number">02</div>
                <h3>Share</h3>
                <p>Send the ID to your team.</p>
              </div>
            </FadeIn>
            <div className="step-connector"></div>
            <FadeIn delay={300}>
              <div className="step-card">
                <div className="step-number">03</div>
                <h3>Code</h3>
                <p>Real-time collaboration.</p>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="faq-section">
          <div className="section-header">
            <h2>FAQ</h2>
          </div>
          <div className="faq-grid">
            <AccordionItem 
              question="Is CollabCode free?" 
              answer="Yes. CollabCode is open-source and free to use for developers." 
            />
             <AccordionItem 
              question="Does it persist my data?" 
              answer="No. It is designed for privacy. Once you leave, the code is gone." 
            />
             <AccordionItem 
              question="Supported languages?" 
              answer="JavaScript, Python, Java, C++, and more coming soon." 
            />
          </div>
        </section>

        <footer className="footer">
          <div className="footer-content">
            <div className="footer-left">
              <div className="logo-small"><span className="logo-icon-sm">{`</>`}</span> CollabCode</div>
              <p>© 2026 Akshat Pandey. Open Source.</p>
            </div>
            <div className="footer-links">
              <a href="https://github.com/AkshatPandey2006" target="_blank">GitHub</a>
              <a href="#">Twitter</a>
            </div>
          </div>
        </footer>

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
            <button onClick={copyRoomId} className="icon-btn" title="Copy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
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
