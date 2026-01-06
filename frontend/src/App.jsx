import { useEffect, useState, useRef, useCallback } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = "https://real-time-code-9ui2.onrender.com/";

// --- Helper: Debounce Function (Performance Optimization) ---
// Prevents flooding the server with events on every keystroke
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const App = () => {
  // ... (Existing State) ...
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [agenda, setAgenda] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [socket, setSocket] = useState(null);
  
  // New State for Features
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  // --- 1. Socket Connection & Setup ---
  useEffect(() => {
    const s = io(SERVER_URL);
    setSocket(s);

    s.on("userJoined", (users) => setUsers(users));
    
    // Critical: Only update code if it's different to prevent cursor jumping
    s.on("codeUpdate", (newCode) => {
      setCode((prev) => (prev !== newCode ? newCode : prev));
    });

    s.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is Typing`);
      setTimeout(() => setTyping(""), 2000);
    });

    s.on("languageUpdate", (newLang) => setLanguage(newLang));

    return () => s.disconnect();
  }, []);

  // --- 2. Performance: Debounced Emitters ---
  // We create a ref to hold the debounced function so it persists across renders
  const debouncedCodeEmit = useRef(
    debounce((s, r, c) => {
      s.emit("codeChange", { roomId: r, code: c });
    }, 300)
  ).current;

  const debouncedTypingEmit = useRef(
    debounce((s, r, u) => {
      s.emit("typing", { roomId: r, userName: u });
    }, 500)
  ).current;

  // --- 3. Handlers ---
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socket && roomId) {
      debouncedCodeEmit(socket, roomId, newCode);
      debouncedTypingEmit(socket, roomId, userName);
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value || e; // Handle both event and direct string
    setLanguage(newLang);
    if (socket) socket.emit("languageChange", { roomId, language: newLang });
  };

  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, userName, agenda });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// start code here");
    setLanguage("javascript");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert("Copied!"); // Simple alert replaced with Toast in real app
  };

  // --- 4. Command Palette Logic (The "Wow" Feature) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCmdPalette((prev) => !prev);
      }
      // Close on Escape
      if (e.key === "Escape") setShowCmdPalette(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const executeCommand = (cmd) => {
    switch (cmd) {
      case "copy": copyRoomId(); break;
      case "leave": leaveRoom(); break;
      case "clear": handleCodeChange(""); break;
      case "js": handleLanguageChange("javascript"); break;
      case "py": handleLanguageChange("python"); break;
      case "java": handleLanguageChange("java"); break;
      case "cpp": handleLanguageChange("cpp"); break;
      default: break;
    }
    setShowCmdPalette(false);
  };

  // --- 5. Resize Logic ---
  const startResizing = () => setIsResizing(true);
  const stopResizing = () => setIsResizing(false);
  const resize = useCallback((e) => {
    if (isResizing && e.clientX > 150 && e.clientX < 600) {
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

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Collab Code</h1>
          <div className="input-group">
            <input placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            <input placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} />
            <input placeholder="Agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} />
          </div>
          <button onClick={joinRoom} className="btn-join">Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* Command Palette Overlay */}
      {showCmdPalette && (
        <div className="cmd-palette-overlay" onClick={() => setShowCmdPalette(false)}>
          <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
            <input autoFocus type="text" placeholder="Type a command..." className="cmd-input" />
            <div className="cmd-list">
              <div className="cmd-item" onClick={() => executeCommand("copy")}><span>Copy Room ID</span><span className="shortcut">ID</span></div>
              <div className="cmd-item" onClick={() => executeCommand("clear")}><span>Clear Code</span><span className="shortcut">Del</span></div>
              <div className="cmd-item" onClick={() => executeCommand("js")}><span>Set Language: JS</span><span className="shortcut">JS</span></div>
              <div className="cmd-item" onClick={() => executeCommand("py")}><span>Set Language: Python</span><span className="shortcut">PY</span></div>
              <div className="cmd-item danger" onClick={() => executeCommand("leave")}><span>Leave Room</span><span className="shortcut">Esc</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-header">
           <h2 title={agenda}>{agenda || "Code Room"}</h2>
           <div className="room-id-box">ID: {roomId}</div>
        </div>
        <div className="users-list">
          <h3>Active Users</h3>
          <ul>{users.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
        <div className="hint-box">
             💡 Press <code>Ctrl/Cmd + K</code> for commands
        </div>
      </div>
      
      <div className="resizer" onMouseDown={startResizing} />

      <div className="main-area">
        <div className="toolbar">
           <select className="lang-select" value={language} onChange={handleLanguageChange}>
             <option value="javascript">JavaScript</option>
             <option value="python">Python</option>
             <option value="java">Java</option>
             <option value="cpp">C++</option>
           </select>
           <span className="typing-indicator">{typing}</span>
        </div>
        <div className="editor-wrapper">
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
