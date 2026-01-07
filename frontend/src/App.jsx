import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import Peer from "peerjs"; 
import axios from "axios"; 

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
  
  // Feature 2: Run Code State
  const [output, setOutput] = useState(""); 
  const [isRunning, setIsRunning] = useState(false);

  // Feature 1: Video State
  const [myPeer, setMyPeer] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [peers, setPeers] = useState({}); 
  const [remoteStreams, setRemoteStreams] = useState([]); 

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // 1. Initialize Socket
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

  // 2. Initialize PeerJS (Video) - FIXED
  useEffect(() => {
    // Use public PeerJS server
    const p = new Peer(); 

    p.on("open", (id) => {
      setMyPeer(p);
      console.log("My Peer ID:", id);
    });

    return () => p.destroy();
  }, []);

  // 3. Socket Event Listeners
  useEffect(() => {
    if (!socket || !myPeer) return;

    socket.on("userJoined", (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on("notification", (msg) => addToast(msg, "success"));
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
      socket.off("userJoined");
      socket.off("notification");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
    };
  }, [socket, myPeer, addToast]);

  // 4. Handle Incoming Video Calls
  useEffect(() => {
    if (!myPeer || !myStream) return;

    myPeer.on("call", (call) => {
      console.log("Receiving call...");
      call.answer(myStream); 
      
      call.on("stream", (userVideoStream) => {
        setRemoteStreams((prev) => {
            if(prev.some(s => s.peerId === call.peer)) return prev;
            return [...prev, { peerId: call.peer, stream: userVideoStream }]
        });
      });
    });
  }, [myPeer, myStream]);

  // 5. Connect to New Users (Call Logic)
  useEffect(() => {
    if (!socket || !myPeer || !myStream) return;
    
    users.forEach(user => {
        if (user.peerId !== myPeer.id && !peers[user.peerId]) {
            const call = myPeer.call(user.peerId, myStream);
            
            call.on("stream", (userVideoStream) => {
                setRemoteStreams((prev) => {
                    if(prev.some(s => s.peerId === user.peerId)) return prev;
                    return [...prev, { peerId: user.peerId, stream: userVideoStream, userName: user.userName }]
                });
            });

            setPeers(prev => ({ ...prev, [user.peerId]: call }));
        }
    });

  }, [users, myPeer, myStream, socket, peers]);


  // Actions
  const joinRoom = async () => {
    if (roomId && userName && socket && myPeer) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMyStream(stream);
        
        socket.emit("join", { roomId, userName, agenda, peerId: myPeer.id });
        setJoined(true);
      } catch (err) {
        addToast("Camera/Mic permission needed", "error");
        console.error(err);
      }
    } else {
      addToast("Room ID, Name & Ready State required", "error");
    }
  };

  const leaveRoom = () => {
    if (socket) socket.emit("leaveRoom");
    if (myStream) myStream.getTracks().forEach(track => track.stop());
    setMyStream(null);
    setRemoteStreams([]);
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// Start coding...");
    setOutput("");
  };

  const updateCode = (newCode) => {
    setCode(newCode);
    if (socket) {
      socket.emit("codeChange", { roomId, code: newCode });
      socket.emit("typing", { roomId, userName });
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput("Running...");
    
    const languageMap = {
        javascript: { language: 'javascript', version: '18.15.0' },
        python: { language: 'python', version: '3.10.0' },
        java: { language: 'java', version: '15.0.2' },
        cpp: { language: 'c++', version: '10.2.0' }
    };

    const langConfig = languageMap[language] || languageMap.javascript;

    try {
        const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
            language: langConfig.language,
            version: langConfig.version,
            files: [{ content: code }]
        });
        
        const { run: { output, stderr } } = response.data;
        setOutput(output || stderr || "No Output");
    } catch (error) {
        setOutput("Error running code: " + error.message);
    } finally {
        setIsRunning(false);
    }
  };

  const updateLanguage = (newLang) => {
    setLanguage(newLang);
    if (socket) socket.emit("languageChange", { roomId, language: newLang });
  };

  const toggleMic = () => {
    if(myStream) myStream.getAudioTracks()[0].enabled = !myStream.getAudioTracks()[0].enabled;
  };
  
  const toggleCam = () => {
    if(myStream) myStream.getVideoTracks()[0].enabled = !myStream.getVideoTracks()[0].enabled;
  };

  return {
    socket, isConnected, joined, roomId, setRoomId, userName, setUserName,
    agenda, setAgenda, language, setLanguage, code, users, typing, toasts,
    joinRoom, leaveRoom, updateCode, updateLanguage, addToast,
    runCode, output, isRunning, myStream, remoteStreams, toggleMic, toggleCam
  };
};

// --- VIDEO COMPONENT ---
const VideoPlayer = ({ stream, muted = false, label }) => {
    const ref = useRef();
    useEffect(() => {
        if(ref.current && stream) ref.current.srcObject = stream;
    }, [stream]);
    return (
        <div className="video-container">
            <video ref={ref} autoPlay playsInline muted={muted} className="video-feed" />
            <div className="video-label">{label}</div>
        </div>
    );
};

// --- UI COMPONENTS ---
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
  return ( <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`fade-in ${isVisible ? "visible" : ""}`}> {children} </div> );
};

const Icons = {
  ArrowRight: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
  Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
  Play: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
  Mic: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
  Video: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Github: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
};

// --- MAIN APP ---
const App = () => {
  const {
    isConnected, joined, roomId, setRoomId, userName, setUserName,
    agenda, setAgenda, language, setLanguage, code, users, typing, toasts,
    joinRoom, leaveRoom, updateCode, updateLanguage, addToast,
    runCode, output, isRunning, myStream, remoteStreams, toggleMic, toggleCam
  } = useRoom();

  const [sidebarWidth, setSidebarWidth] = useState(300); 
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

  // --- LANDING PAGE ---
  if (!joined) {
    return (
      <div className="landing-container">
        <div className="grid-background"></div>
        <div className="spotlight"></div>

        <nav className="navbar">
          <div className="nav-content">
            <div className="logo"><span className="logo-glitch">{`</>`}</span> CollabCode</div>
            <div className="nav-right">
                <a href="https://github.com/AkshatPandey2006/Real_Code_Editor" target="_blank" className="github-link"><Icons.Github /> <span>Star on GitHub</span></a>
                <div className={`status-pill ${isConnected ? 'online' : 'offline'}`}>
                <div className="dot"></div> {isConnected ? "System Online" : "Connecting..."}
                </div>
            </div>
          </div>
        </nav>

        {/* HERO SECTION */}
        <section className="hero-section">
            <div className="hero-content-wrapper">
                
                {/* Left Column: Text */}
                <div className="hero-left fade-in-up">
                    <div className="hero-badge">
                        <span className="badge-dot"></span> v2.0 Now Public
                    </div>
                    <h1 className="hero-title">
                        Lightning-fast <br />
                        collab coding, <br />
                        <span className="gradient-text">Zero friction.</span>
                    </h1>
                    <p className="hero-sub">
                        Built for interviews, pair programming, and competitive programming practice. Spin up instant coding rooms with a powerful, VS Code-like editor. 
                    </p>
                    <div className="hero-cta">
                        <button className="primary-btn large" onClick={() => document.getElementById('join-box').scrollIntoView({ behavior: 'smooth' })}>
                            Start Session <Icons.ArrowRight />
                        </button>
                    </div>
                    <div className="credibility-badge">
                        <p>⚡ Open-source • Built with React, Node.js, Socket.IO • Deployed on Render</p>
                    </div>
                </div>

                {/* Right Column: Visual + Join Box */}
                <div className="hero-right fade-in-up" style={{animationDelay: '0.2s'}} id="join-box">
                    
                    {/* The Form Overlay */}
                    <div className="glass-panel join-panel">
                        <div className="panel-header">
                        <h2>Initialize Workspace</h2>
                        <p>Secure, ephemeral environments.</p>
                        </div>
                        
                        <div className="input-group">
                        <label>1. ROOM ID</label>
                        <div className="input-with-action">
                            <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="e.g. A4X92Z" maxLength={8}/>
                            <button onClick={generateRoomId}>Generate</button>
                        </div>
                        </div>

                        <div className="input-group">
                        <label>2. DISPLAY NAME</label>
                        <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. Akshat" />
                        </div>

                        <div className="input-group">
                        <label>3. LANGUAGE</label>
                        <select className="custom-select" value={language} onChange={e => setLanguage(e.target.value)}>
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="cpp">C++</option>
                        </select>
                        </div>

                        <div className="input-group">
                        <label>AGENDA <span className="optional">(OPTIONAL)</span></label>
                        <input value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="e.g. Pair Programming" />
                        </div>

                        <button className="primary-btn full-width" onClick={joinRoom} disabled={!isConnected}>
                        {isConnected ? "Start Session" : "Connecting..."} <Icons.ArrowRight />
                        </button>
                    </div>
                </div>
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
              <a href="https://github.com/AkshatPandey2006/Real_Code_Editor" target="_blank">GitHub</a>
              <a href="https://www.linkedin.com/in/akshatpandey2006/">LinkedIn</a>
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

        {/* --- VIDEO SECTION --- */}
        <div className="video-grid">
            {myStream && <VideoPlayer stream={myStream} muted={true} label="You" />}
            {remoteStreams.map(s => (
                <VideoPlayer key={s.peerId} stream={s.stream} label={users.find(u => u.peerId === s.peerId)?.userName || "User"} />
            ))}
        </div>
        
        <div className="video-controls">
            <button className="control-btn" onClick={toggleMic}><Icons.Mic /></button>
            <button className="control-btn" onClick={toggleCam}><Icons.Video /></button>
        </div>

        <div className="users-section">
          <div className="section-title"><Icons.Users /> ONLINE ({users.length})</div>
          <div className="user-list">
            {users.map((u, i) => (
              <div key={i} className="user-item">
                <div className="avatar" style={{background: '#3b82f6'}}>{u.userName[0].toUpperCase()}</div>
                <span className="name">{u.userName}</span>
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
            <button className={`run-btn ${isRunning ? 'loading' : ''}`} onClick={runCode} disabled={isRunning}>
                <Icons.Play /> {isRunning ? "Running..." : "Run"}
            </button>
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
            }}
          />
        </div>

        {/* --- OUTPUT TERMINAL --- */}
        <div className="terminal-panel">
            <div className="terminal-header">Console Output</div>
            <pre className="terminal-content">{output || "Run code to see output..."}</pre>
        </div>

        <div className="status-bar">
          <div className="status-item">Spaces: 2</div>
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

export default App;
