import { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { LuPanelLeftClose,LuPanelRightClose} from "react-icons/lu";
import * as Y from "yjs";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import { QuillBinding } from "y-quill";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import "quill/dist/quill.snow.css";

Quill.register("modules/cursors",QuillCursors);

const API_BASE = "https://contentshareroom.onrender.com";

function App() {
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [isSideBarOpen,setSideBarOpen]=useState(true);
  const [fileExtension, setFileExtension] = useState(".txt");
  const [usersCount, setUsersCount] = useState(1);
  const [activeUsers, setActiveUsers] = useState([]);

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("landing"); // "landing", "login", "signup", "lobby"
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("pulsepad_token");
    if (token) {
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          setCurrentUser(data.username);
          setUserName(data.username);
          setPage("lobby");
        })
        .catch(() => {
          localStorage.removeItem("pulsepad_token");
        })
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const isLogin = page === "login";
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const body = isLogin
      ? { username: authForm.username, password: authForm.password }
      : { username: authForm.username, email: authForm.email, password: authForm.password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Something went wrong");
        return;
      }
      localStorage.setItem("pulsepad_token", data.token);
      setCurrentUser(data.username);
      setUserName(data.username);
      setAuthForm({ username: "", email: "", password: "" });
      setPage("lobby");
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pulsepad_token");
    setCurrentUser(null);
    setUserName("");
    setPage("landing");
  };

   const stompClient = useRef(null);
   const typingTimeOutRef=useRef(null);

   const ydocRef=useRef(new Y.Doc());
   const editorBindingRef=useRef(null);
   const editorContainerRef=useRef(null);

   const awarenessRef = useRef(null);
   if (!awarenessRef.current) {
    awarenessRef.current = new Awareness(ydocRef.current);
    
    // Assign a random username and color to this user
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
    awarenessRef.current.setLocalStateField("user", {
      name: "User_" + Math.floor(Math.random() * 1000), // e.g., User_492
      color: randomColor,
    });
  }

  useEffect(() => {
    if (!isJoined) return;

    fetch(`${API_BASE}/api/room/${roomId}`)
       .then((response)=>response.json())
       .then((data)=>{

        if(data.content && Array.isArray(data.content)){
          const updateArray=new Uint8Array(data.content);
          Y.applyUpdate(ydocRef.current,updateArray,"initial-sync");
        }
       })
       .catch((error)=>console.error("Failed to fetch initial state:",error));


    const client = new Client({
      brokerURL: `wss://${new URL(API_BASE).host}/ws`,

      onConnect: () => {
        console.log(`Connected to room: ${roomId}`);

        client.subscribe(`/topic/room/${roomId}`, (message) => {
          const receivedData = JSON.parse(message.body);
          
          if(receivedData.content && Array.isArray(receivedData.content)){
            const updateArray=new Uint8Array(receivedData.content);
            Y.applyUpdate(ydocRef.current,updateArray,"stomp");
          }
        });
        client.subscribe(`/topic/cursor/${roomId}`, (message) => {
          const receivedData = JSON.parse(message.body);
          if (receivedData.awareness && Array.isArray(receivedData.awareness)) {
            const awarenessUpdate = new Uint8Array(receivedData.awareness);
            applyAwarenessUpdate(awarenessRef.current, awarenessUpdate, "stomp");
          }
        });
      },
      onWebSocketError: (error) => {
        console.error("WebSocket Error:", error);
      },
      onStompError: (frame) => {
        console.error("Broker reported error: " + frame.headers['message']);
        if (frame.headers['message'] && frame.headers['message'].includes("Room is full")) {
          alert("Room is full. Maximum 3 users allowed.");
          setIsJoined(false);
          setRoomId("");
        }
      },
    });

    client.activate();
    stompClient.current = client;

    const updateHandler = (update,origin) => {
    if(origin==="stomp" || origin==="initial-sync")return;

    if(typingTimeOutRef.current){
      clearTimeout(typingTimeOutRef.current);
    }

    typingTimeOutRef.current=setTimeout(()=>{
      if (stompClient.current && stompClient.current.connected) {
         const fullState=Y.encodeStateAsUpdate(ydocRef.current);
         stompClient.current.publish({
          destination: `/app/code/${roomId}`,
          body: JSON.stringify({ content: Array.from(fullState) }),
      });
      }
      },400);
  };

  const awarenessHandler = ({ added, updated, removed }, origin) => {
      setUsersCount(awarenessRef.current.getStates().size);
      
      const states = Array.from(awarenessRef.current.getStates().values());
      const users = states.map(state => state.user).filter(Boolean);
      setActiveUsers(users);

      if (origin === "stomp") return;
      
      const changedClients = added.concat(updated, removed);
      if (stompClient.current && stompClient.current.connected) {
        // Encode only the cursor locations that just changed
        const awarenessUpdate = encodeAwarenessUpdate(awarenessRef.current, changedClients);
        stompClient.current.publish({
          destination: `/app/cursor/${roomId}`,
          body: JSON.stringify({ awareness: Array.from(awarenessUpdate) }),
        });
      }
    };
  ydocRef.current.on("update",updateHandler);
  awarenessRef.current.on("update", awarenessHandler);

    return () => {
      client.deactivate();
      ydocRef.current.off("update",updateHandler);
      awarenessRef.current.off("update", awarenessHandler);
    };
  }, [isJoined,roomId]);

  useEffect(()=>{
    if (isJoined && editorContainerRef.current && !editorBindingRef.current){
      const quill = new Quill(editorContainerRef.current, {
        theme: "snow",
        modules: {
          cursors: true, // Enable multiplayer cursors
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["clean"]
          ],
        },
      });
      const ytext = ydocRef.current.getText("quill-document");
      editorBindingRef.current = new QuillBinding(ytext, quill,awarenessRef.current);
    }

    return () => {
      if (editorBindingRef.current && !isJoined) {
        editorBindingRef.current.destroy();
        editorBindingRef.current = null;
      }
    };
  }, [isJoined]);

  const createRoom = ()=>{
    if (userName.trim() === "") {
      alert("Please enter your name first");
      return;
    }
    const random=Math.random();
    let num=Math.round(random*1000000);
    if(num.toString().length<6)num+=100000;
    setRoomId(num.toString());

    awarenessRef.current.setLocalStateField("user", {
      name: userName,
      color: awarenessRef.current.getLocalState().user.color,
    });
    setIsJoined(true);
  }

  const downloadFile = () => {
    if (!ydocRef.current) return;
    const ytext = ydocRef.current.getText("quill-document");
    const content = ytext.toString(); 
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulsepad_document${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Loading state while checking token
  if (!authChecked) {
    return (
      <div className="lobbyContainer">
        <h2 className="lobbyTitle" style={{ fontSize: '1.5rem' }}>LOADING...</h2>
      </div>
    );
  }

  // ─── LANDING PAGE ───
  if (!isJoined && page === "landing") {
    return (
      <div className="lobbyContainer">
        <div className="landing-card">
          <h1 className="landing-title">PULSEPAD</h1>
          <p className="landing-subtitle">Real-time collaborative editing</p>
          <div className="landing-btn-group">
            <button className="btn btn-primary" onClick={() => { setAuthError(""); setAuthForm({ username: "", email: "", password: "" }); setPage("login"); }}>
              LOGIN
            </button>
            <button className="btn btn-secondary" onClick={() => { setAuthError(""); setAuthForm({ username: "", email: "", password: "" }); setPage("signup"); }}>
              SIGN UP
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOGIN PAGE ───
  if (!isJoined && page === "login") {
    return (
      <div className="lobbyContainer">
        <form className="auth-page-card" onSubmit={handleAuth}>
          <button type="button" className="auth-back-btn" onClick={() => setPage("landing")}>← BACK</button>
          <h2 className="lobbyTitle">LOGIN</h2>
          {authError && <div className="auth-error">{authError}</div>}
          <input
            className="lobbyInputRoom"
            type="text"
            placeholder="USERNAME"
            value={authForm.username}
            onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
            required
          />
          <input
            className="lobbyInputRoom"
            type="password"
            placeholder="PASSWORD"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            required
            minLength={4}
          />
          <button className="btn btn-primary" type="submit" disabled={authLoading}>
            {authLoading ? "PLEASE WAIT..." : "LOGIN"}
          </button>
          <p className="auth-switch">
            Don't have an account? <span onClick={() => { setAuthError(""); setPage("signup"); }}>Sign Up</span>
          </p>
        </form>
      </div>
    );
  }

  // ─── SIGNUP PAGE ───
  if (!isJoined && page === "signup") {
    return (
      <div className="lobbyContainer">
        <form className="auth-page-card" onSubmit={handleAuth}>
          <button type="button" className="auth-back-btn" onClick={() => setPage("landing")}>← BACK</button>
          <h2 className="lobbyTitle">SIGN UP</h2>
          {authError && <div className="auth-error">{authError}</div>}
          <input
            className="lobbyInputRoom"
            type="text"
            placeholder="USERNAME"
            value={authForm.username}
            onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
            required
          />
          <input
            className="lobbyInputRoom"
            type="email"
            placeholder="EMAIL"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
            required
          />
          <input
            className="lobbyInputRoom"
            type="password"
            placeholder="PASSWORD"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            required
            minLength={4}
          />
          <button className="btn btn-primary" type="submit" disabled={authLoading}>
            {authLoading ? "PLEASE WAIT..." : "CREATE ACCOUNT"}
          </button>
          <p className="auth-switch">
            Already have an account? <span onClick={() => { setAuthError(""); setPage("login"); }}>Login</span>
          </p>
        </form>
      </div>
    );
  }

  // ─── LOBBY PAGE (Room Join) ───
  if (!isJoined && page === "lobby") {
    return (
      <div className="lobbyContainer">
        {/* Logged-in user info - top right */}
        <div className="lobby-auth-bar">
          <div className="auth-user-info">
            <span className="auth-username">{currentUser}</span>
            <button className="btn-auth btn-auth-logout" onClick={handleLogout}>LOGOUT</button>
          </div>
        </div>

        <form
          className="lobbyCard"
          onSubmit={async (e) => {
            e.preventDefault();
            if (roomId.trim() !== "" && userName.trim() !== "") {
              try {
                const response = await fetch(`${API_BASE}/api/room/${roomId}/check-join`);
                if (!response.ok) {
                  const errorData = await response.json();
                  alert(errorData.error || "Room is full. Maximum 3 users allowed.");
                  return;
                }
              } catch (error) {
                console.error("Failed to check join status", error);
                alert("Failed to check room status.");
                return;
              }
              
              awarenessRef.current.setLocalStateField("user", {
                name: userName,
                color: awarenessRef.current.getLocalState().user.color,
              });
              setIsJoined(true);
            } else if (userName.trim() === "") {
              alert("Please enter your name first");
            }
          }}
        >
          <h2 className="lobbyTitle">PULSEPAD</h2>
          <input
            className="lobbyInputRoom"
            type="text"
            placeholder="ENTER YOUR NAME"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            style={{ marginBottom: '10px' }}
          />
          <input
            className="lobbyInputRoom"
            type="text"
            placeholder="ENTER ROOM ID"
            value={roomId}
            minLength={6}
            maxLength={6}
            onChange={(e) => setRoomId(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit">
            JOIN ROOM
          </button>

          <button className="btn btn-secondary" 
           type="button"
           onClick={createRoom}
          >
            CREATE ROOM
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className={`sidebar ${isSideBarOpen ? "" : "sidebar-closed"}`} style={{width:`${isSideBarOpen?'280px':'60px'}`}}>
        <div className="toggle-btn-container">
          <button className="toggle-btn" onClick={() => setSideBarOpen(!isSideBarOpen)}>
            {isSideBarOpen ? <LuPanelLeftClose size={24} /> : <LuPanelRightClose size={24} />}
          </button>
        </div>
        <div className="sidebar-content">
          <h2 className="sidebar-header">TERMINAL</h2>
          <div className="room-info">
            <p>CONNECTION SECURE</p>
            <span className="room-id-highlight">{roomId}</span>
          </div>
          <div className="room-info" style={{ marginTop: '10px' }}>
            <p>ACTIVE USERS</p>
            <span className="room-id-highlight" style={{ fontSize: '1.2rem', color: 'var(--neon-magenta)', textShadow: 'var(--glow-magenta)' }}>{usersCount}</span>
            <ul style={{ listStyleType: 'none', padding: 0, marginTop: '10px' }}>
              {activeUsers.map((u, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: u.color, boxShadow: `0 0 5px ${u.color}` }}></span>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>{u.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1, minHeight: '40px' }}></div>
          <button
            className="btn btn-danger"
            onClick={() => {
              setIsJoined(false);
              setRoomId("");
            }}
          >
            DISCONNECT
          </button>
        </div>
      </div>
     
      <div className="main-area">
        <header className="editor-header">
          <h1 className="editor-title">PULSEPAD</h1>
        </header>

        <div className="editor-container-wrapper">
          <div className="editor-inner-box">
            <div className="download-controls" style={{ position: 'absolute', top: '8px', right: '12px', zIndex: 10, display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select 
                value={fileExtension} 
                onChange={(e) => setFileExtension(e.target.value)}
                className="extension-select"
              >
                <option value=".txt">.txt</option>
                <option value=".js">.js</option>
                <option value=".java">.java</option>
                <option value=".py">.py</option>
                <option value=".html">.html</option>
                <option value=".css">.css</option>
                <option value=".json">.json</option>
                <option value=".md">.md</option>
              </select>
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', margin: 0 }} onClick={downloadFile}>
                DOWNLOAD
              </button>
            </div>
            <div ref={editorContainerRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
