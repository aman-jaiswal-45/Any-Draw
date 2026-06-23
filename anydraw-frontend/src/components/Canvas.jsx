import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconButton } from "./IconButton.jsx";
import {
  Circle,
  Pencil,
  RectangleHorizontalIcon,
  MousePointer2,
  Type,
  Minus,
  MoveUpRight,
  Diamond,
  Eraser,
  ZoomIn,
  ZoomOut,
  Move,
  Undo2,
  Redo2,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-react";
import { Game } from "../draw/Game.js";
import { useTheme } from "../context/ThemeContext.jsx";

const getCurrentUserId = () => {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const payloadBase64 = token.split(".")[1];
    const decodedPayload = JSON.parse(atob(payloadBase64));
    return decodedPayload.userId;
  } catch (e) {
    console.error("Error parsing JWT token:", e);
    return null;
  }
};

export default function Canvas({ roomId, socket }) {
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const [game, setGame] = useState(undefined);
  const [selectedTool, setSelectedTool] = useState("pencil");
  const { isDark, theme, setTheme } = useTheme();
  
  // Set initial stroke color depending on dark/light mode
  const [color, setColor] = useState(isDark ? "#ffffff" : "#000000");
  const [stroke, setStroke] = useState(2);

  const [approvalStatus, setApprovalStatus] = useState("checking");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [canWrite, setCanWrite] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  const currentUserId = getCurrentUserId();
  const isCurrentUserHost = collaborators.some((c) => c.userId === currentUserId && c.isHost);

  // Register callbacks on game once it's created
  useEffect(() => {
    if (!game) return;

    game.setStatusCallback((status) => {
      if (status === "rejected") {
        setApprovalStatus((prev) => {
          if (prev === "checking") {
            navigate("/dashboard");
            return "checking";
          }
          return "rejected";
        });
      } else {
        setApprovalStatus(status);
      }
    });

    game.setPendingRequestsCallback((requests) => {
      setPendingRequests(requests);
    });

    game.setCollaboratorsCallback((cols) => {
      setCollaborators(cols);
    });

    game.setRoomDeletedCallback(() => {
      setApprovalStatus("deleted");
    });

    game.setWritePermissionCallback((val) => {
      setCanWrite(val);
    });

    game.setRoomLockCallback((val) => {
      setIsLocked(val);
    });
  }, [game]);

  useEffect(() => {
    if (game) {
      game.setIsHost(isCurrentUserHost);
    }
  }, [game, isCurrentUserHost]);

  // Sync color if theme toggles and color is currently at default white/black
  useEffect(() => {
    if (!isDark && color === "#ffffff") {
      setColor("#000000");
    } else if (isDark && color === "#000000") {
      setColor("#ffffff");
    }
  }, [isDark]);

  // Sync game tool and style whenever anything changes
  useEffect(() => {
    if (game) {
      game.setTool(selectedTool);
      game.setStrokeColor(color);
      game.setStrokeWidth(stroke);
    }
  }, [game, selectedTool, color, stroke]);

  // Initialize Game once
  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current, roomId, socket, currentUserId);
    setGame(g);

    g.setZoom(1);
    g.setCamera(0, 0);

    return () => {
      g.destroy();
    };
  }, [roomId, socket]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !game) return;

    const onWheel = (ev) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const delta = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      game.setZoom(game.getZoom() * delta, cx, cy);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [game]);

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-white dark:bg-[#0f172a] transition-colors duration-200">
      {/* Overlays */}
      {approvalStatus === "checking" && (
        <div className="absolute inset-0 z-[1000] flex flex-col justify-center items-center bg-slate-900 text-white gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-lg font-medium animate-pulse">Checking access permissions...</p>
        </div>
      )}

      {approvalStatus === "pending" && (
        <div className="absolute inset-0 z-[1000] flex flex-col justify-center items-center bg-slate-950 text-white px-6">
          <div className="max-w-md w-full text-center space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="relative flex justify-center">
              <div className="absolute w-24 h-24 bg-blue-500/10 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Waiting Room</h2>
              <p className="text-slate-400 text-base">Your join request has been sent to the room administrator. Please wait for approval.</p>
            </div>
            <div className="pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse"></span>
                Admin is currently online & reviewing
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalStatus === "offline" && (
        <div className="absolute inset-0 z-[1000] flex flex-col justify-center items-center bg-slate-955 text-white px-6">
          <div className="max-w-md w-full text-center space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="relative flex justify-center">
              <div className="absolute w-24 h-24 bg-slate-700/10 rounded-full animate-pulse"></div>
              <div className="relative w-20 h-20 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-300 to-slate-500 bg-clip-text text-transparent">Admin is Offline</h2>
              <p className="text-slate-400 text-base">The room administrator is currently away. Your request has been queued and will be shown to them as soon as they return.</p>
            </div>
            <div className="pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <span className="w-2.5 h-2.5 bg-slate-500 rounded-full"></span>
                Request is persisted in offline queue
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalStatus === "rejected" && (
        <div className="absolute inset-0 z-[1000] flex flex-col justify-center items-center bg-slate-950 text-white px-6">
          <div className="max-w-md w-full text-center space-y-8 bg-slate-900 p-8 rounded-2xl border border-red-900/40 shadow-2xl">
            <div className="relative flex justify-center">
              <div className="w-20 h-20 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Access Denied</h2>
              <p className="text-slate-400 text-base">Access Denied. Your request to join this drawing room has been rejected by the administrator. Please try again later.</p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalStatus === "deleted" && (
        <div className="absolute inset-0 z-[1000] flex flex-col justify-center items-center bg-slate-950 text-white px-6">
          <div className="max-w-md w-full text-center space-y-8 bg-slate-900 p-8 rounded-2xl border border-red-900/40 shadow-2xl">
            <div className="relative flex justify-center">
              <div className="w-20 h-20 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Room Deleted</h2>
              <p className="text-slate-400 text-base">This room has been permanently deleted by the administrator.</p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalStatus === "removed" && (
        <div className="absolute inset-0 z-[1000] flex flex-col justify-center items-center bg-slate-950 text-white px-6">
          <div className="max-w-md w-full text-center space-y-8 bg-slate-900 p-8 rounded-2xl border border-red-900/40 shadow-2xl">
            <div className="relative flex justify-center">
              <div className="w-20 h-20 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 21v-1a6 6 0 00-9-5.197M21 21v-1a6 6 0 00-3-4.82M18 10l3 3m0 0l-3 3m3-3H12" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Access Revoked</h2>
              <p className="text-slate-400 text-base">Access Revoked. You have been removed from this drawing room by the administrator.</p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-colors shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Pending Requests Panel */}
      {pendingRequests.length > 0 && (
        <div className="fixed top-4 right-4 z-[1000] max-w-sm w-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"></span>
              Join Requests ({pendingRequests.length})
            </h3>
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
            {pendingRequests.map((req) => (
              <div key={req.userId} className="flex flex-col gap-2 p-2.5 bg-slate-100/60 dark:bg-slate-800/60 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{req.userName}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{req.userEmail}</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => game?.rejectJoin(req.userId)}
                    className="py-1 px-3 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-md transition-colors shadow-md"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => game?.approveJoin(req.userId)}
                    className="py-1 px-3 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-md transition-colors shadow-md"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="block bg-transparent"
        style={{
          cursor: selectedTool === "eraser" ? "crosshair" : "default",
        }}
      />

      {!isCurrentUserHost && (
        <>
          {!canWrite && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/95 border border-slate-700/80 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 z-[998] backdrop-blur-md animate-pulse">
              <svg className="w-4 h-4 text-amber-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs font-bold text-slate-100 tracking-wide uppercase">View-Only Mode</span>
            </div>
          )}
          {canWrite && isLocked && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-red-950/95 border border-red-800/80 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 z-[998] backdrop-blur-md animate-pulse">
              <svg className="w-4 h-4 text-red-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs font-bold text-red-200 tracking-wide uppercase">Canvas Frozen by Host</span>
            </div>
          )}
        </>
      )}

      <Topbar
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        game={game}
        color={color}
        setColor={setColor}
        stroke={stroke}
        setStroke={setStroke}
        isDark={isDark}
        collaborators={collaborators}
        currentUserId={currentUserId}
        isCurrentUserHost={isCurrentUserHost}
        canWrite={canWrite}
        isLocked={isLocked}
      />
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
  game,
  color,
  setColor,
  stroke,
  setStroke,
  isDark,
  collaborators = [],
  currentUserId,
  isCurrentUserHost,
  canWrite,
  isLocked,
}) {
  const isDrawingDisabled = (!canWrite || isLocked) && !isCurrentUserHost;
  const activeTool = isDrawingDisabled ? "select" : selectedTool;
  const [showCollaborators, setShowCollaborators] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!showCollaborators) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCollaborators(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCollaborators]);

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        left: 10,
        zIndex: 999,
        maxWidth: "96vw",
        maxHeight: "96vh",
      }}
    >
      <div
        className="flex flex-wrap bg-white/95 dark:bg-slate-900/90 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 items-center gap-1 shadow-lg dark:shadow-2xl transition-colors duration-200"
        style={{ display: "flex", alignItems: "center", maxWidth: "90vw" }}
      >
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("pencil")}
          activated={activeTool === "pencil"}
          icon={<Pencil className="w-5 h-5" />}
          title="Pencil"
        />
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("rect")}
          activated={activeTool === "rect"}
          icon={<RectangleHorizontalIcon className="w-5 h-5" />}
          title="Rectangle"
        />
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("circle")}
          activated={activeTool === "circle"}
          icon={<Circle className="w-5 h-5" />}
          title="Circle"
        />
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("line")}
          activated={activeTool === "line"}
          icon={<Minus className="w-5 h-5" />}
          title="Line"
        />
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("arrow")}
          activated={activeTool === "arrow"}
          icon={<MoveUpRight className="w-5 h-5" />}
          title="Arrow"
        />
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("diamond")}
          activated={activeTool === "diamond"}
          icon={<Diamond className="w-5 h-5" />}
          title="Diamond"
        />
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("text")}
          activated={activeTool === "text"}
          icon={<Type className="w-5 h-5" />}
          title="Text"
        />
        <IconButton
          onClick={() => setSelectedTool("select")}
          activated={activeTool === "select"}
          icon={<MousePointer2 className="w-5 h-5" />}
          title="Selection"
        />
        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => setSelectedTool("eraser")}
          activated={activeTool === "eraser"}
          icon={<Eraser className="w-5 h-5" />}
          title="Eraser"
        />
        
        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => game?.undo()}
          activated={false}
          icon={<Undo2 className="w-5 h-5" />}
          title="Undo (Ctrl+Z)"
        />

        <IconButton
          disabled={isDrawingDisabled}
          onClick={() => game?.redo()}
          activated={false}
          icon={<Redo2 className="w-5 h-5" />}
          title="Redo (Ctrl+Y)"
        />

        {isCurrentUserHost && (
          <>
            <IconButton
              onClick={() => {
                if (game?.selectedShapeId) {
                  game.bringToFront(game.selectedShapeId);
                } else {
                  alert("Please select a shape first using the Selection tool.");
                }
              }}
              activated={false}
              icon={<ArrowUpToLine className="w-5 h-5" />}
              title="Bring to Front"
            />
            <IconButton
              onClick={() => {
                if (game?.selectedShapeId) {
                  game.sendToBack(game.selectedShapeId);
                } else {
                  alert("Please select a shape first using the Selection tool.");
                }
              }}
              activated={false}
              icon={<ArrowDownToLine className="w-5 h-5" />}
              title="Send to Back"
            />
          </>
        )}

        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* color & stroke controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 8,
          }}
        >
          <input
            disabled={isDrawingDisabled}
            aria-label="Stroke color"
            title="Stroke color"
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              game?.setStrokeColor(e.target.value);
            }}
            className={`w-7 h-7 bg-transparent border-0 cursor-pointer rounded ${isDrawingDisabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
          />
          <input
            disabled={isDrawingDisabled}
            aria-label="Stroke width"
            title="Stroke width"
            type="range"
            min={1}
            max={30}
            value={stroke}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStroke(v);
              game?.setStrokeWidth(v);
            }}
            className={`w-20 md:w-28 accent-blue-500 ${isDrawingDisabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
          />
        </div>

        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* zoom/pan quick buttons */}
        <div className="flex gap-1">
          <IconButton
            onClick={() => game?.setZoom((game?.getZoom() || 1) * 1.12)}
            activated={false}
            icon={<ZoomIn className="w-5 h-5" />}
            title="Zoom In"
          />
          <IconButton
            onClick={() => game?.setZoom((game?.getZoom() || 1) / 1.12)}
            activated={false}
            icon={<ZoomOut className="w-5 h-5" />}
            title="Zoom Out"
          />
          <IconButton
            onClick={() => game?.resetCamera()}
            activated={false}
            icon={<Move className="w-5 h-5" />}
            title="Reset Viewport"
          />
        </div>

        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Room Lock Button (Host only) */}
        {isCurrentUserHost && (
          <button
            onClick={() => {
              game?.toggleRoomLock(!isLocked);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border transition-all ${
              isLocked
                ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
                : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350"
            }`}
            title={isLocked ? "Unlock Canvas for Collaborators" : "Freeze Canvas for Collaborators"}
          >
            {isLocked ? (
              <svg className="w-5 h-5 animate-pulse text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            )}
            <span className="hidden md:inline">{isLocked ? "Canvas Frozen" : "Freeze"}</span>
          </button>
        )}

        {isCurrentUserHost && <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1" />}

        {/* Collaborators list trigger */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setShowCollaborators(!showCollaborators)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors"
            title="Active Participants"
          >
            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {collaborators.length}
            </span>
          </button>
          
          {showCollaborators && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 z-[1001] space-y-2">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wider uppercase mb-1">Active Collaborators</h4>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {collaborators.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Just you in the room</p>
                ) : (
                  collaborators.map((c) => (
                    <div key={c.userId} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg justify-between">
                      <div className="flex items-center gap-2 overflow-hidden text-left">
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                          {c.userName.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                            {c.userName}
                            {c.isHost && (
                              <span className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[9px] px-1 py-0.2 rounded font-bold border border-yellow-500/20">
                                Host
                              </span>
                            )}
                            {!c.canWrite && !c.isHost && (
                              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] px-1 py-0.2 rounded font-bold border border-amber-500/20 flex items-center gap-0.5" title="Read-Only Mode">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Read-Only
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.userEmail}</p>
                        </div>
                      </div>
                      
                      {isCurrentUserHost && !c.isHost && (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Draw permission toggle button */}
                          <button
                            onClick={() => {
                              game?.toggleWritePermission(c.userId, !c.canWrite);
                            }}
                            className={`p-1 rounded transition-colors ${
                              c.canWrite
                                ? "text-green-500 hover:bg-green-500/10 hover:text-green-600"
                                : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-605"
                            }`}
                            title={c.canWrite ? "Set to Read-Only Mode" : "Set to Write Mode"}
                          >
                            {c.canWrite ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            )}
                          </button>

                          {/* Kick button */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove ${c.userName} from this room?`)) {
                                game?.removeUser(c.userId);
                              }
                            }}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10 hover:text-red-650 transition-colors"
                            title="Remove user from canvas"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 21v-1a6 6 0 00-9-5.197M21 21v-1a6 6 0 00-3-4.82M18 10l3 3m0 0l-3 3m3-3H12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
