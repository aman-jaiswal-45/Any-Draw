import React, { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { Game } from "../draw/Game.js";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Canvas({ roomId, socket }) {
  const canvasRef = useRef(null);
  const [game, setGame] = useState(undefined);
  const [selectedTool, setSelectedTool] = useState("pencil");
  const { isDark, theme, setTheme } = useTheme();
  
  // Set initial stroke color depending on dark/light mode
  const [color, setColor] = useState(isDark ? "#ffffff" : "#000000");
  const [stroke, setStroke] = useState(2);

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
    const g = new Game(canvasRef.current, roomId, socket);
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
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="block bg-transparent"
        style={{
          cursor: selectedTool === "eraser" ? "crosshair" : "default",
        }}
      />
      <Topbar
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        game={game}
        color={color}
        setColor={setColor}
        stroke={stroke}
        setStroke={setStroke}
        isDark={isDark}
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
}) {
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
          onClick={() => setSelectedTool("pencil")}
          activated={selectedTool === "pencil"}
          icon={<Pencil className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("rect")}
          activated={selectedTool === "rect"}
          icon={<RectangleHorizontalIcon className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("circle")}
          activated={selectedTool === "circle"}
          icon={<Circle className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("line")}
          activated={selectedTool === "line"}
          icon={<Minus className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("arrow")}
          activated={selectedTool === "arrow"}
          icon={<MoveUpRight className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("diamond")}
          activated={selectedTool === "diamond"}
          icon={<Diamond className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("text")}
          activated={selectedTool === "text"}
          icon={<Type className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("select")}
          activated={selectedTool === "select"}
          icon={<MousePointer2 className="w-5 h-5" />}
        />
        <IconButton
          onClick={() => setSelectedTool("eraser")}
          activated={selectedTool === "eraser"}
          icon={<Eraser className="w-5 h-5" />}
        />
        
        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        <IconButton
          onClick={() => game?.undo()}
          activated={false}
          icon={<Undo2 className="w-5 h-5" />}
        />

        <IconButton
          onClick={() => game?.redo()}
          activated={false}
          icon={<Redo2 className="w-5 h-5" />}
        />

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
            aria-label="Stroke color"
            title="Stroke color"
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              game?.setStrokeColor(e.target.value);
            }}
            className="w-7 h-7 bg-transparent border-0 cursor-pointer rounded"
          />
          <input
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
            className="w-20 md:w-28 accent-blue-500"
          />
        </div>

        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* zoom/pan quick buttons */}
        <div className="flex gap-1">
          <IconButton
            onClick={() => game?.setZoom((game?.getZoom() || 1) * 1.12)}
            activated={false}
            icon={<ZoomIn className="w-5 h-5" />}
          />
          <IconButton
            onClick={() => game?.setZoom((game?.getZoom() || 1) / 1.12)}
            activated={false}
            icon={<ZoomOut className="w-5 h-5" />}
          />
          <IconButton
            onClick={() => game?.resetCamera()}
            activated={false}
            icon={<Move className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  );
}
