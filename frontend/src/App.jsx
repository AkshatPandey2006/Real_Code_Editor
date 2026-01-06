import { useEffect, useState, useRef, useCallback } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

// --- constants ---
const SERVER_URL = "https://real-time-code-9ui2.onrender.com/";
const SOCKET_OPTIONS = {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

// --- Helper: Debounce Function ---
// Prevents flooding the server with events on every single keystroke.
// This is the key "Senior Engineer" optimization.
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// --- Custom Hook: useRoom ---
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

  // --- Optimization: Debounced Socket Emitters ---
  // We use useRef to keep the same debounced function instance across renders.
  
  // 1. Debounce Code Changes (300ms delay)
  // Only sends code to server if user stops typing for 300ms
  const debouncedEmitCode = useRef(
    debounce((socketInstance, rId, newCode) => {
      socketInstance.emit("codeChange", { roomId: rId, code: newCode });
    }, 300)
  ).current;

  // 2. Throttle Typing Indicators (500ms delay)
  // Prevents "User is typing" spam
  const debouncedEmitTyping = useRef(
    debounce((socketInstance, rId, uName) => {
      socketInstance.emit("typing", { roomId: rId, userName: uName });
    }, 500)
  ).current;

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

    s.on("connect", () => {
      setIsConnected(true);
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      addToast("Disconnected from server", "error");
    });

    s.on("connect_error", (err) => {
      setIsConnected(false);
      console.error("Connection error:", err);
    });

    return () => {
      s.disconnect();
    };
  }, [addToast]);

  useEffect(() => {
    if (!socket) return;

    s.on("userJoined", (updatedUsers) => {
      setUsers(updatedUsers);
      addToast("A new user joined the room", "success");
    });

    s.on("codeUpdate", (newCode) => {
      // Critical: Only update if code is different to prevent cursor jumps
      setCode((prev) => (prev !== newCode ? newCode : prev));
    });

    s.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 10)}... is typing`);
      const timer = setTimeout(() => setTyping(""), 2000);
      return () => clearTimeout(timer);
    });

    s.on("languageUpdate", (newLanguage) => {
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
    setLanguage("javascript");
  };

  const updateCode = (newCode) => {
    // 1. Update local state IMMEDIATELY (Responsiveness)
    setCode(newCode);

    // 2. Update server AFTER delay (Performance)
    if (socket) {
      debouncedEmitCode(socket, roomId, newCode);
      debouncedEmitTyping(socket, roomId, userName);
    }
  };

  const updateLanguage = (newLang) => {
    setLanguage(newLang);
    if (socket) socket.emit("languageChange", { roomId, language: newLang });
  };

  const emitCursorPosition = (position) => {
    if (socket) {
      socket.emit("cursorChange", { roomId, userName, position });
    }
  };

  return {
    socket,
    isConnected,
    joined,
    roomId, setRoomId,
    userName, setUserName,
    agenda, setAgenda,
    language,
    code,
    users,
    typing,
    toasts,
    joinRoom,
    leaveRoom,
    updateCode,
    updateLanguage,
    emitCursorPosition,
    addToast
  };
};

// --- Main Component ---
const App = () => {
  const {
    isConnected,
    joined,
    roomId, setRoomId,
    userName, setUserName,
    agenda, setAgenda,
    language,
    code,
    users,
    typing,
    toasts,
    joinRoom,
    leaveRoom,
    updateCode,
    updateLanguage,
    emitCursorPosition,
    addToast
  } = useRoom();

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = () => setIsResizing(true);
  const stopResizing = () => setIsResizing(false);
  const resize = useCallback((e) => {
    if (isResizing) {
      if (e.clientX > 200 && e.clientX < 600) setSidebarWidth(e.clientX);
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
    const id = Math.random().toString(36).substring(2, 9);
    setRoomId(id);
  };

  const handleEditorMount = (editor, monaco) => {
    editor.onDidChangeCursorPosition((e) => {
      emitCursorPosition(e.position);
    });
  };

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <div className="form-header">
            <h1>Collab Code</h1>
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
              placeholder="Agenda (e.g., DSA Practice)"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              onKeyUp={(e) => e.key === "Enter" && joinRoom()}
            />
          </div>
          <button onClick={joinRoom} className="btn-join" disabled={!isConnected}>
            {isConnected ? "Join Room" : "Connecting..."}
          </button>
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
  }

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
            onMount={handleEditorMount}
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

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

export default App;
