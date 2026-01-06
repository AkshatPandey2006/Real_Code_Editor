import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = "https://real-time-code-9ui2.onrender.com/";
const SOCKET_OPTIONS = {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

// --- HOOKS ---
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
    
    socket.on("updateUserList", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on("userJoined", (user) => {
      addToast(`${user} joined the room`, "success");
    });

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

// --- COMPONENTS ---
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
  ArrowRight: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
  Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Lightning: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  Shield: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Code: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>,
  Github: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
};

// --- MAIN APP ---
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

  // --- LANDING PAGE VIEW ---
  if (!joined) {
    return (
      <div className="landing-container">
        <div className="grid-background"></div>
        <div className="spotlight"></div>

        <nav className="navbar">
          <div className="nav-content">
            <div className="logo"><span className="logo-glitch">{`</>`}</span> CollabCode</div>
            <div className="nav-right">
                <a href="https://github.com/AkshatPandey2006" target="_blank" className="github-link"><Icons.Github /> <span>Star on GitHub</span></a>
                <div className={`status-pill ${isConnected ? 'online' : 'offline'}`}>
                <div className="dot"></div> {isConnected ? "System Online" : "Connecting..."}
                </div>
            </div>
          </div>
        </nav>

        {/* HERO SECTION (2-Column Layout) */}
        <section className="hero-section">
            <div className="hero-content-wrapper">
                
                {/* Left Column: Text */}
                <div className="hero-left fade-in-up">
                    <div className="hero-badge">
                        <span className="badge-dot"></span> v2.0 Now Public
                    </div>
                    <h1 className="hero-title">
                        Lightning-fast <br />
                        collab coding. <br />
                        <span className="gradient-text">Zero friction.</span>
                    </h1>
                    <p className="hero-sub">
                        Spin up instant coding rooms with a powerful, VS Code-like editor. 
                        Powered by WebSockets for sub-30ms sync. No sign-ups, secure by default.
                    </p>
                    <div className="hero-cta">
                        <button className="primary-btn large" onClick={() => document.getElementById('join-box').scrollIntoView({ behavior: 'smooth' })}>
                            Start Coding Now <Icons.ArrowRight />
                        </button>
                    </div>
                    <div className="trusted-by">
                        <p>Open Source and free forever.</p>
                    </div>
                </div>

                {/* Right Column: Join Box */}
                <div className="hero-right fade-in-up" style={{animationDelay: '0.2s'}} id="join-box">
                    <div className="glass-panel join-panel">
                        <div className="panel-header">
                        <h2>Initialize Workspace</h2>
                        <p>Secure, ephemeral environments.</p>
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
                        <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. Akshat" />
                        </div>

                        <div className="input-group">
                        <label>AGENDA <span className="optional">(OPTIONAL)</span></label>
                        <input value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="e.g. Pair Programming" />
                        </div>

                        <button className="primary-btn" onClick={joinRoom} disabled={!isConnected}>
                        {isConnected ? "Launch Editor" : "Connecting..."} <Icons.ArrowRight />
                        </button>
                    </div>
                </div>
            </div>
        </section>
        
        {/* FEATURES */}
        <section className="features">
          <div className="section-header">
            <h2>Engineered for performance</h2>
            <p>A developer-first experience without the bloated tooling.</p>
          </div>
          <div className="bento-grid">
            <FadeIn delay={100}>
              <div className="bento-card">
                <div className="card-icon"><Icons.Lightning /></div>
                <h3>Instant Sync</h3>
                <p>WebSocket architecture ensures <span className="highlight">sub-30ms latency</span> anywhere in the world.</p>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="bento-card">
                <div className="card-icon"><Icons.Shield /></div>
                <h3>Secure by Default</h3>
                <p>Ephemeral rooms. Data is wiped from memory as soon as the last user leaves the session.</p>
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

        {/* HOW IT WORKS */}
        <section className="how-it-works">
          <div className="section-header">
            <h2>How it works</h2>
          </div>
          <div className="steps-wrapper">
            <FadeIn delay={100}>
              <div className="step-card">
                <div className="step-number">01</div>
                <h3>Create</h3>
                <p>Generate a unique Room ID.</p>
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

        {/* FAQ */}
        <section className="faq-section">
          <div className="section-header">
            <h2>Frequently asked questions</h2>
          </div>
          <div className="faq-grid">
            <AccordionItem 
              question="Is CollabCode free to use?" 
              answer="Yes, CollabCode is completely free and open-source for developers, students, and interviewers." 
            />
             <AccordionItem 
              question="Does it persist my code?" 
              answer="No. For security reasons, CollabCode is ephemeral. Once all users leave the room, the code is erased forever." 
            />
             <AccordionItem 
              question="What languages are supported?" 
              answer="Currently, we support JavaScript, Python, Java, and C++ with full syntax highlighting via the Monaco editor." 
            />
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-left">
              <div className="logo-small"><span className="logo-glitch">{`</>`}</span> CollabCode</div>
              <p>© 2026 Akshat Pandey. Open Source.</p>
            </div>
            <div className="footer-links">
              <a href="https://github.com/AkshatPandey2006" target="_blank">GitHub</a>
              <a href="#">Twitter</a>
              <a href="#">Status</a>
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

  // --- EDITOR VIEW (When Joined) ---
  return (
    <div className="app-container">
      <div className="grid-background" style={{opacity: 0.1}}></div>
      
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
