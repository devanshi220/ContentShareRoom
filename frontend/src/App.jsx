import { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { LuPanelLeftClose,LuPanelRightClose} from "react-icons/lu";

function App() {
  const [code, setCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const stompClient = useRef(null);
  const [isSideBarOpen,setSideBarOpen]=useState(true);

  useEffect(() => {
    const client = new Client({
      brokerURL: "ws://192.168.31.52:8080/ws",

      onConnect: () => {
        console.log(`Connected to room: ${roomId}`);

        client.subscribe(`/topic/room/${roomId}`, (message) => {
          const receivedData = JSON.parse(message.body);
          setCode(receivedData.content);
        });
      },
      
      onWebSocketError: (error) => {
        console.error("WebSocket Error:", error);
      },
    });

    client.activate();
    stompClient.current = client;

    return () => {
      client.deactivate();
    };
  }, [isJoined]);

  const handleEditorChange = (event) => {
    const newValue = event.target.value;
    setCode(newValue);

    if (stompClient.current && stompClient.current.connected) {
      stompClient.current.publish({
        destination: `/app/code/${roomId}`,
        body: JSON.stringify({ content: newValue }),
      });
    }
  };

  const createRoom = ()=>{
    const random=Math.random();
    let num=Math.round(random*1000000);
    if(num.toString().length<6)num+=100000;
    setRoomId(num);
    setIsJoined(true);
  }

  if (!isJoined) {
    return (
      <div className="lobbyContainer">
        <form
        className="lobbyContainer"
          onSubmit={(e) => {
            e.preventDefault();
            if (roomId.trim() !== "") setIsJoined(true);
          }}
        >
          <h2>Join a Content Share Room</h2>
          <input
            className="lobbyInputRoom"
            type="text"
            placeholder="Enter RoomId"
            value={roomId}
            minLength={6}
            maxLength={6}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button className="lobbyRoomB" type="submit">
            Join Room
          </button>

          <button className="lobbyRoomB" 
           onClick={createRoom}
          >
            Create Room
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="left-div" style={{width:`${isSideBarOpen?'20%':'4%'}`}}>
        <div className="closePanel">
          {isSideBarOpen?<LuPanelLeftClose onClick={()=>{
            setSideBarOpen(!isSideBarOpen)
          }} size={20} />:
           <LuPanelRightClose onClick={()=>{
            setSideBarOpen(!isSideBarOpen)
          }} size={20} />}
        </div>
        {isSideBarOpen && <span>
        <h2>Side Panel</h2>
        <br />
        <p>
          Room Id: <strong>{roomId}</strong>
        </p>
        <br />
        <button
          className="LeaveRoomB"
          onClick={() => {
            setIsJoined(false);
            setCode("");
            setRoomId("");
          }}
        >
          LeaveRoom
        </button>
        </span>
        }
      </div>
     
      <div className="right-div">
        <header className="right-header">
          <h1>Editor</h1>
        </header>

        <textarea
          className="code-editor"
          placeholder="Start typing your code here..."
          spellCheck="false"
          value={code}
          onChange={handleEditorChange}
        />
      </div>
    </div>
  );
}

export default App;
