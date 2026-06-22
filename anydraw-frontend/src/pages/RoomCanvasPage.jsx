import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Canvas from "../components/Canvas.jsx";

const WS_URL = import.meta.env.VITE_WS_BACKEND_URL || "ws://localhost:8080/ws";

export default function RoomCanvasPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      navigate("/signin");
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const joinRequest = searchParams.get("joinRequest");
    const wsUrl = joinRequest 
      ? `${WS_URL}?token=${token}&joinRequest=true` 
      : `${WS_URL}?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setSocket(ws);
      setConnectionError(false);
      if (joinRequest) {
        window.history.replaceState(null, "", `/canvas/${roomId}`);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket connection error:", error);
      setConnectionError(true);
    };

    ws.onclose = () => {
      if (!ws.isTerminal) {
        setSocket(null);
      }
      console.log("WebSocket connection closed");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        // Send leave room before close
        try {
          ws.send(JSON.stringify({
            type: "leave_room",
            roomId: roomId
          }));
        } catch (e) {}
        ws.close();
      }
    };
  }, [roomId, navigate]);

  if (connectionError) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-900 text-white gap-4">
        <p className="text-xl text-red-400">Failed to connect to the drawing server.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-blue-600 rounded hover:bg-blue-500 transition-colors font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!socket) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-lg">Connecting to drawing session...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}
