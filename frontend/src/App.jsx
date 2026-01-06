import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const socket = io("https://real-time-code-9ui2.onrender.com/");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [agenda, setAgenda] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [copySuccess, setCopySuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  
  // Sidebar resizing state
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    socket.on("userJoined", (users) => {
      setUsers(users);
    });

    socket.on("codeUpdate", (newCode) => {
      setCode(newCode);
    });

    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is Typing`);
      setTimeout(() => setTyping(""), 2000);
    });

    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("leaveRoom");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // --- Resizing Logic ---
  const startResizing = (e) => {
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e) => {
    if (isResizing) {
      // Limit min/max width
      if (e.clientX > 150 && e.clientX < 600) {
        setSidebarWidth(e.clientX);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);
  // ----------------------

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
    setAgenda("");
    setCode("// start code here");
    setLanguage("javascript");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 10);
    setRoomId(id);
  };

  const handleInputEnter = (e) => {
    if (e.code === "Enter") {
      joinRoom();
    }
  };

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Collab Code</h1>
          
          <div className="input-group">
            <div className="room-id-wrapper">
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyUp={handleInputEnter}
              />
              <button className="btn-generate" onClick={generateRoomId}>
                Generate
              </button>
            </div>

            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyUp={handleInputEnter}
            />

            <input
              type="text"
              placeholder="Agenda (e.g., LeetCode 101)"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              onKeyUp={handleInputEnter}
            />
          </div>

          <button onClick={joinRoom} className="btn-join">
            Join Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* Sidebar with dynamic width */}
      <div 
        className="sidebar" 
        style={{ width: sidebarWidth }}
        ref={sidebarRef}
      >
        <div className="sidebar-header">
          <h2 title={agenda}>{agenda || "Code Room"}</h2>
          <div className="room-id-box">
            <span>ID: {roomId}</span>
            <button onClick={copyRoomId} className="copy-btn">
              {copySuccess ? "✓" : "📋"}
            </button>
          </div>
        </div>

        <div className="users-list">
          <h3>Active Users</h3>
          <ul>
            {users.map((user, index) => (
              <li key={index} className="user-item">
                <span className="avatar">{user.charAt(0).toUpperCase()}</span>
                <span className="username">{user}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-footer">
          <button className="leave-btn" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      </div>

      {/* Resizer Handle */}
      <div 
        className="resizer"
        onMouseDown={startResizing}
      />

      {/* Main Area */}
      <div className="main-area">
        <div className="toolbar">
          <div className="left-tools">
            <select
              className="lang-select"
              value={language}
              onChange={handleLanguageChange}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>

          <div className="right-tools">
            <span className="typing-indicator">{typing}</span>
          </div>
        </div>

        <div className="editor-wrapper">
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 10 }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
