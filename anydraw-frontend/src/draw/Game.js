"use strict";
import { getExistingShapes } from "./http";
import { Pencil } from "./pencil";
import { Eraser } from "./eraser";
import { SelectTool } from "./select";
import { ResizeTool } from "./resize";
export class Game {
  constructor(canvas, roomId, socket) {
    this.existingShapes = [];
    this.undoStack = [];
    this.redoStack = [];
    // input state
    this.clicked = false;
    this.startX = 0;
    // world coords
    this.startY = 0;
    this.selectedTool = "circle";
    this.defaultStrokeWidth = 2;
    this.defaultStrokeColor = "white";
    this.activePencil = null;
    this.activeEraser = null;
    // CAMERA
    this.cameraX = 0;
    this.cameraY = 0;
    this.zoom = 1;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    // screen coords
    this.cameraStart = { x: 0, y: 0 };
    this.spacePressed = false;
    // dragging selected shapes
    this.isDraggingShape = false;
    this.dragStartWorld = { x: 0, y: 0 };
    this.dragOriginalShape = null;
    this.selectedShapeId = null;
    this.keyComboListener = (e) => {
      if (e.ctrlKey && e.key === "z") this.undo();
      if (e.ctrlKey && e.key === "y") this.redo();
    };
    this.keyDown = (e) => {
      if (e.code === "Space") this.spacePressed = true;
    };
    this.keyUp = (e) => {
      if (e.code === "Space") this.spacePressed = false;
    };
    // ---- MOUSE HANDLERS ----
    // mousedown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.mouseDownHandler = (ev) => {
      const screen = this.getCanvasScreenCoords(ev);
      const world = this.screenToWorld(screen.x, screen.y);
      if (ev.button === 1 || this.spacePressed) {
        this.isPanning = true;
        this.panStart = { x: screen.x, y: screen.y };
        this.cameraStart = { x: this.cameraX, y: this.cameraY };
        return;
      }
      this.clicked = true;
      this.startX = world.x;
      this.startY = world.y;
      if (this.selectedTool === "pencil") {
        this.saveStateForUndo();
        this.activePencil = new Pencil(this.defaultStrokeWidth, this.defaultStrokeColor);
        this.activePencil.addPoint(world.x, world.y);
        return;
      }
      if (this.selectedTool === "eraser") {
        this.saveStateForUndo();
        if (!this.activeEraser) this.activeEraser = new Eraser(10);
        const shapeId = this.activeEraser.findShapeAt(world.x, world.y, this.existingShapes);
        if (shapeId) {
          this.existingShapes = this.existingShapes.filter((s) => s.id !== shapeId);
          this.socket.send(JSON.stringify({ type: "delete", id: shapeId, roomId: this.roomId }));
          this.clearCanvas();
          this.notifyLayersChanged();
        }
        return;
      }
      if (this.selectedTool === "select") {
        this.saveStateForUndo();
        const found = this.selectTool.findAt(screen.x, screen.y, this.existingShapes);
        this.selectedShapeId = found ?? null;
        this.resizeTool.setSelectedId(this.selectedShapeId);
        this.clearCanvas();
        if (this.selectedShapeId) {
          const stored = this.existingShapes.find((s) => s.id === this.selectedShapeId);
          if (stored) {
            this.isDraggingShape = true;
            this.dragStartWorld = { x: world.x, y: world.y };
            this.dragOriginalShape = JSON.parse(JSON.stringify(stored.shape));
          }
        }
        return;
      }
      if (this.selectedTool === "resize") {
        this.saveStateForUndo();
        if (!this.selectedShapeId) {
          const found = this.selectTool.findAt(ev.offsetX, ev.offsetY, this.existingShapes);
          this.selectedShapeId = found ?? null;
          this.resizeTool.setSelectedId(this.selectedShapeId);
          this.clearCanvas();
          return;
        }
        const stored = this.existingShapes.find((s) => s.id === this.selectedShapeId);
        if (!stored) return;
        const handle = this.resizeTool.hitTestHandles(ev.offsetX, ev.offsetY, stored.shape);
        if (handle) {
          this.resizeTool.startResize(this.selectedShapeId, stored.shape, ev.offsetX, ev.offsetY, handle);
        } else {
          const found = this.selectTool.findAt(ev.offsetX, ev.offsetY, this.existingShapes);
          this.selectedShapeId = found ?? null;
          this.resizeTool.setSelectedId(this.selectedShapeId);
        }
        this.clearCanvas();
        return;
      }
    };
    // mouseup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.mouseUpHandler = (ev) => {
      if (this.isPanning) {
        this.isPanning = false;
        return;
      }
      const screen = this.getCanvasScreenCoords(ev);
      const world = this.screenToWorld(screen.x, screen.y);
      this.clicked = false;
      if (this.isDraggingShape && this.selectedShapeId && this.dragOriginalShape) {
        const dx = world.x - this.dragStartWorld.x;
        const dy = world.y - this.dragStartWorld.y;
        const newShape = this.translateShape(this.dragOriginalShape, dx, dy);
        const idx = this.existingShapes.findIndex((s) => s.id === this.selectedShapeId);
        if (idx !== -1) this.existingShapes[idx].shape = newShape;
        this.socket.send(JSON.stringify({ type: "update", id: this.selectedShapeId, shape: newShape, roomId: this.roomId }));
        this.isDraggingShape = false;
        this.dragOriginalShape = null;
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (this.selectedTool === "pencil" && this.activePencil) {
        this.saveStateForUndo();
        const shape = {
          type: "pencil",
          path: this.activePencil.getPath(),
          strokeWidth: this.activePencil.getStrokeWidth(),
          strokeColor: this.activePencil.getStrokeColor()
        };
        const pendingId2 = `pending-${Date.now()}`;
        this.existingShapes.push({ id: pendingId2, shape, tempId: pendingId2 });
        this.clearCanvas();
        this.socket.send(JSON.stringify({ type: "chat", tempId: pendingId2, shape, roomId: this.roomId }));
        this.activePencil = null;
        this.notifyLayersChanged();
        return;
      }
      if (this.selectedTool === "resize" && this.resizeTool.isResizing()) {
        this.saveStateForUndo();
        const newShape = this.resizeTool.applyResize(ev.offsetX, ev.offsetY);
        const id = this.resizeTool.getSelectedId();
        if (id && newShape) {
          const idx = this.existingShapes.findIndex((s) => s.id === id);
          if (idx !== -1) this.existingShapes[idx].shape = newShape;
          this.socket.send(JSON.stringify({ type: "update", id, shape: newShape, roomId: this.roomId }));
          this.clearCanvas();
          this.notifyLayersChanged();
        }
        this.resizeTool.finishResize();
        return;
      }
      const width = world.x - this.startX;
      const height = world.y - this.startY;
      const selectedTool = this.selectedTool;
      let shapeToSend = null;
      const strokeWidth = this.defaultStrokeWidth;
      const strokeColor = this.defaultStrokeColor;
      if (selectedTool === "rect") {
        this.saveStateForUndo();
        shapeToSend = { type: "rect", x: this.startX, y: this.startY, width, height, strokeWidth, strokeColor };
      } else if (selectedTool === "circle") {
        this.saveStateForUndo();
        const radius = Math.sqrt(width * width + height * height) / 2;
        shapeToSend = {
          type: "circle",
          radius,
          centerX: this.startX + width / 2,
          centerY: this.startY + height / 2,
          strokeWidth,
          strokeColor
        };
      } else if (selectedTool === "line") {
        this.saveStateForUndo();
        shapeToSend = { type: "line", startX: this.startX, startY: this.startY, endX: world.x, endY: world.y, strokeWidth, strokeColor };
      } else if (selectedTool === "arrow") {
        this.saveStateForUndo();
        shapeToSend = { type: "arrow", startX: this.startX, startY: this.startY, endX: world.x, endY: world.y, strokeWidth, strokeColor };
      } else if (selectedTool === "diamond") {
        this.saveStateForUndo();
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;
        const cornerRadius = Math.min(Math.abs(width), Math.abs(height)) * 0.08 || 6;
        shapeToSend = { type: "diamond", centerX, centerY, width: Math.abs(width), height: Math.abs(height), strokeWidth, strokeColor, cornerRadius };
      } else if (selectedTool === "text") {
        this.saveStateForUndo();
        const w = Math.abs(width);
        const h = Math.abs(height);
        const fontSize = Math.max(12, Math.abs(height));
        const textShape = {
          type: "text",
          x: this.startX,
          y: this.startY,
          width: w,
          height: h,
          text: "",
          fontSize,
          fontFamily: "Arial",
          lineHeight: 1.2,
          textAlign: "left",
          verticalAlign: "top",
          strokeWidth,
          strokeColor
        };
        const input = document.createElement("textarea");
        const screenPos = this.worldToScreen(this.startX, this.startY);
        input.style.position = "absolute";
        input.style.left = `${screenPos.x}px`;
        input.style.top = `${screenPos.y}px`;
        input.style.width = `${w * this.zoom}px`;
        input.style.height = `${h * this.zoom}px`;
        input.style.fontSize = `${fontSize * this.zoom}px`;
        input.style.fontFamily = textShape.fontFamily;
        input.style.color = strokeColor;
        input.style.background = "transparent";
        input.style.border = "1px dashed white";
        input.style.outline = "none";
        input.style.resize = "none";
        input.style.overflow = "hidden";
        input.style.whiteSpace = "pre-wrap";
        input.style.wordWrap = "break-word";
        input.style.lineHeight = `${textShape.lineHeight}`;
        document.body.appendChild(input);
        input.focus();
        input.addEventListener("blur", () => {
          textShape.text = input.value;
          const pendingId2 = `pending-${Date.now()}`;
          this.existingShapes.push({ id: pendingId2, shape: textShape, tempId: pendingId2 });
          this.clearCanvas();
          this.socket.send(JSON.stringify({ type: "chat", tempId: pendingId2, shape: textShape, roomId: this.roomId }));
          document.body.removeChild(input);
          this.notifyLayersChanged();
        });
        shapeToSend = null;
      }
      if (!shapeToSend) {
        return;
      }
      const pendingId = `pending-${Date.now()}`;
      this.existingShapes.push({ id: pendingId, shape: shapeToSend, tempId: pendingId });
      this.clearCanvas();
      this.socket.send(JSON.stringify({ type: "chat", tempId: pendingId, shape: shapeToSend, roomId: this.roomId }));
      this.notifyLayersChanged();
    };
    // mousemove
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.mouseMoveHandler = (ev) => {
      const screen = this.getCanvasScreenCoords(ev);
      const world = this.screenToWorld(screen.x, screen.y);
      if (this.isPanning) {
        const dx = screen.x - this.panStart.x;
        const dy = screen.y - this.panStart.y;
        this.cameraX = this.cameraStart.x - dx / this.zoom;
        this.cameraY = this.cameraStart.y - dy / this.zoom;
        this.clearCanvas();
        if (this.selectedTool === "eraser" && this.activeEraser) {
          this.saveStateForUndo();
          this.activeEraser.drawPreview(this.ctx, screen.x, screen.y);
        }
        return;
      }
      if (this.selectedTool === "select" && this.isDraggingShape && this.dragOriginalShape && this.selectedShapeId) {
        this.saveStateForUndo();
        const dx = world.x - this.dragStartWorld.x;
        const dy = world.y - this.dragStartWorld.y;
        const preview = this.translateShape(this.dragOriginalShape, dx, dy);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.getCanvasBgColor();
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.cameraX * this.zoom, -this.cameraY * this.zoom);
        for (const s of this.existingShapes) {
          if (s.id === this.selectedShapeId) {
            this.drawShape(preview);
          } else {
            this.drawShape(s.shape);
          }
        }
        this.selectTool.drawSelection(this.ctx, this.existingShapes);
        this.resizeTool.drawHandles(this.ctx, preview);
        return;
      }
      if (this.selectedTool === "pencil" && this.activePencil && this.clicked) {
        this.saveStateForUndo();
        this.activePencil.addPoint(world.x, world.y);
        this.clearCanvas();
        this.activePencil.draw(this.ctx);
        return;
      }
      if (this.selectedTool === "resize" && this.resizeTool.isResizing()) {
        this.saveStateForUndo();
        const preview = this.resizeTool.applyResize(ev.offsetX, ev.offsetY);
        if (preview && this.resizeTool.getSelectedId()) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.fillStyle = this.getCanvasBgColor();
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          for (const s of this.existingShapes) {
            if (s.id === this.resizeTool.getSelectedId()) this.drawShape(preview);
            else this.drawShape(s.shape);
          }
          this.selectTool.drawSelection(this.ctx, this.existingShapes);
          this.resizeTool.drawHandles(this.ctx, preview);
        }
        return;
      }
      if (this.selectedTool === "eraser") {
        this.saveStateForUndo();
        this.clearCanvas();
        if (!this.activeEraser) this.activeEraser = new Eraser(10);
        this.activeEraser.drawPreview(this.ctx, screen.x, screen.y);
        return;
      }
      if (this.clicked) {
        this.clearCanvas();
        this.ctx.save();
        this.ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.cameraX * this.zoom, -this.cameraY * this.zoom);
        if (this.selectedTool === "rect") {
          this.saveStateForUndo();
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.ctx.strokeRect(this.startX, this.startY, world.x - this.startX, world.y - this.startY);
        } else if (this.selectedTool === "circle") {
          this.saveStateForUndo();
          const w = world.x - this.startX;
          const h = world.y - this.startY;
          const radius = Math.sqrt(w * w + h * h) / 2;
          const cx = this.startX + w / 2;
          const cy = this.startY + h / 2;
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, Math.abs(radius), 0, Math.PI * 2);
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.ctx.stroke();
        } else if (this.selectedTool === "line") {
          this.saveStateForUndo();
          this.ctx.beginPath();
          this.ctx.moveTo(this.startX, this.startY);
          this.ctx.lineTo(world.x, world.y);
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.ctx.stroke();
        } else if (this.selectedTool === "arrow") {
          this.saveStateForUndo();
          const headlen = 15;
          const dx = world.x - this.startX;
          const dy = world.y - this.startY;
          const angle = Math.atan2(dy, dx);
          this.ctx.beginPath();
          this.ctx.moveTo(this.startX, this.startY);
          this.ctx.lineTo(world.x, world.y);
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.ctx.stroke();
          this.ctx.beginPath();
          this.ctx.moveTo(world.x, world.y);
          this.ctx.lineTo(world.x - headlen * Math.cos(angle - Math.PI / 6), world.y - headlen * Math.sin(angle - Math.PI / 6));
          this.ctx.lineTo(world.x - headlen * Math.cos(angle + Math.PI / 6), world.y - headlen * Math.sin(angle + Math.PI / 6));
          this.ctx.lineTo(world.x, world.y);
          this.ctx.stroke();
        } else if (this.selectedTool === "diamond") {
          this.saveStateForUndo();
          const w = world.x - this.startX;
          const h = world.y - this.startY;
          const cx = this.startX + w / 2;
          const cy = this.startY + h / 2;
          const cornerRadius = Math.min(Math.abs(w), Math.abs(h)) * 0.08 || 6;
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.drawRoundedDiamond(this.ctx, cx, cy, Math.abs(w), Math.abs(h), cornerRadius);
        } else if (this.selectedTool === "text") {
          this.saveStateForUndo();
          this.ctx.strokeStyle = "white";
          this.ctx.lineWidth = 1;
          this.ctx.setLineDash([6, 6]);
          this.ctx.strokeRect(this.startX, this.startY, world.x - this.startX, world.y - this.startY);
          this.ctx.setLineDash([]);
        }
        this.ctx.restore();
        return;
      }
    };
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get canvas 2D context");
    this.ctx = ctx;
    this.roomId = roomId;
    this.socket = socket;
    this.resizeTool = new ResizeTool();
    this.selectTool = new SelectTool((id, info) => {
      this.selectedShapeId = id;
      this.resizeTool.setSelectedId(id);
      if (!id) return;
      if (info?.part === "inside") {
        this.setTool("select");
      } else if (info?.part === "handle") {
        this.setTool("resize");
      }
    });
    this.initHandlers();
    this.init();
    this.initMouseHandlers();
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("keydown", this.keyComboListener);
  }
  saveState() {
    const snapshot = JSON.parse(JSON.stringify(this.existingShapes));
    this.undoStack.push(snapshot);
    this.redoStack = [];
  }
  saveStateForUndo() {
    const snapshot = JSON.parse(JSON.stringify(this.existingShapes));
    this.undoStack.push(snapshot);
    this.redoStack = [];
  }
  setLayersCallback(cb) {
    this.layersCallback = cb;
  }
  getLayers() {
    return this.existingShapes.slice();
  }
  notifyLayersChanged() {
    this.layersCallback?.(this.getLayers());
  }
  bringToFront(id) {
    const idx = this.existingShapes.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const [item] = this.existingShapes.splice(idx, 1);
    this.existingShapes.push(item);
    this.clearCanvas();
    this.notifyLayersChanged();
    this.sendReorder();
  }
  sendReorder() {
    const order = this.existingShapes.map((s) => s.id);
    this.socket.send(JSON.stringify({ type: "reorder", order, roomId: this.roomId }));
  }
  // helpers
  translateShape(shape, dx, dy) {
    if (shape.type === "rect") return { ...shape, x: shape.x + dx, y: shape.y + dy };
    if (shape.type === "circle") return { ...shape, centerX: shape.centerX + dx, centerY: shape.centerY + dy };
    if (shape.type === "line" || shape.type === "arrow") return { ...shape, startX: shape.startX + dx, startY: shape.startY + dy, endX: shape.endX + dx, endY: shape.endY + dy };
    if (shape.type === "diamond") return { ...shape, centerX: shape.centerX + dx, centerY: shape.centerY + dy };
    if (shape.type === "pencil") {
      const newPath = shape.path.map((p) => [p[0] + dx, p[1] + dy]);
      return { ...shape, path: newPath };
    }
    if (shape.type === "text") return { ...shape, x: shape.x + dx, y: shape.y + dy };
    return shape;
  }
  destroy() {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("keydown", this.keyComboListener);
  }
  setStrokeWidth(width) {
    this.defaultStrokeWidth = width;
    this.activePencil?.setStrokeWidth(width);
  }
  setStrokeColor(color) {
    this.defaultStrokeColor = color;
    this.activePencil?.setStrokeColor(color);
  }
  async init() {
    try {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "join_room", roomId: this.roomId }));
      } else {
        this.socket.addEventListener("open", () => {
          this.socket.send(JSON.stringify({ type: "join_room", roomId: this.roomId }));
        });
      }
    } catch (e) {
      console.error("[Game] failed to send join_room message:", e);
    }
    this.clearCanvas();
    this.notifyLayersChanged();
  }
  undo() {
    if (this.undoStack.length === 0) return;
    const previous = this.undoStack.pop();
    const current = JSON.parse(JSON.stringify(this.existingShapes));
    this.redoStack.push(current);
    this.existingShapes = previous;
    this.clearCanvas();
    this.notifyLayersChanged();
    this.socket.send(JSON.stringify({
      type: "undo",
      roomId: this.roomId,
      state: this.existingShapes
    }));
  }
  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    const current = JSON.parse(JSON.stringify(this.existingShapes));
    this.undoStack.push(current);
    this.existingShapes = next;
    this.clearCanvas();
    this.notifyLayersChanged();
    this.socket.send(JSON.stringify({
      type: "redo",
      roomId: this.roomId,
      state: this.existingShapes
    }));
  }
  initHandlers() {
    this.socket.onmessage = (event) => {
      let parsed = null;
      try {
        parsed = JSON.parse(event.data);
      } catch (err) {
        console.warn("[Game] failed to parse WS message", err);
        return;
      }
      if (!parsed || typeof parsed.type !== "string") return;
      if (parsed.type === "room_state" || parsed.type === "undo" || parsed.type === "redo") {
        const serverShapes = parsed.shapes || [];
        this.existingShapes = serverShapes.map((s) => ({
          id: String(s.id),
          shape: s.shape
        }));
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (parsed.type === "chat") {
        const serverId = String(parsed.id);
        const serverShape = parsed.shape;
        const tempId = parsed.tempId;
        if (tempId) {
          const idx = this.existingShapes.findIndex((s) => s.tempId === tempId || s.id === tempId);
          if (idx !== -1) {
            this.existingShapes[idx] = { id: serverId, shape: serverShape };
            this.clearCanvas();
            this.notifyLayersChanged();
            return;
          }
        }
        const already = this.existingShapes.some((s) => s.id === serverId);
        if (!already) {
          this.existingShapes.push({ id: serverId, shape: serverShape });
        }
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (parsed.type === "delete") {
        const deletedId = String(parsed.id);
        this.existingShapes = this.existingShapes.filter((s) => s.id !== deletedId);
        if (this.selectedShapeId === deletedId) {
          this.selectedShapeId = null;
          this.selectTool.clearSelection();
          this.resizeTool.finishResize();
        }
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (parsed.type === "reorder") {
        const order = parsed.order;
        const idTo = new Map(this.existingShapes.map((s) => [s.id, s.shape]));
        const newList = [];
        for (const id of order) {
          const shape = idTo.get(id);
          if (shape) newList.push({ id, shape });
        }
        for (const s of this.existingShapes) {
          if (!newList.find((x) => x.id === s.id)) newList.push(s);
        }
        this.existingShapes = newList;
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (parsed.type === "update") {
        const id = String(parsed.id);
        const shape = parsed.shape;
        const idx = this.existingShapes.findIndex((s) => s.id === id);
        if (idx !== -1) {
          this.existingShapes[idx].shape = shape;
        } else {
          this.existingShapes.push({ id, shape });
        }
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      console.warn("[Game] unknown WS message type:", parsed.type);
    };
  }
  // ---- CAMERA / TRANSFORMS ----
  setCamera(x, y) {
    this.cameraX = x;
    this.cameraY = y;
    this.clearCanvas();
  }
  panBy(dxScreen, dyScreen) {
    this.cameraX -= dxScreen / this.zoom;
    this.cameraY -= dyScreen / this.zoom;
    this.clearCanvas();
  }
  setZoom(newZoom, screenX, screenY) {
    const minZ = 0.1;
    const maxZ = 8;
    newZoom = Math.max(minZ, Math.min(maxZ, newZoom));
    if (screenX != null && screenY != null) {
      const worldBefore = this.screenToWorld(screenX, screenY);
      this.zoom = newZoom;
      const worldAfter = this.screenToWorld(screenX, screenY);
      this.cameraX += worldBefore.x - worldAfter.x;
      this.cameraY += worldBefore.y - worldAfter.y;
    } else {
      this.zoom = newZoom;
    }
    this.clearCanvas();
  }
  getZoom() {
    return this.zoom;
  }
  resetCamera() {
    this.cameraX = 0;
    this.cameraY = 0;
    this.zoom = 1;
    this.clearCanvas();
  }
  // coordinate helpers
  getCanvasScreenCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  screenToWorld(sx, sy) {
    return { x: sx / this.zoom + this.cameraX, y: sy / this.zoom + this.cameraY };
  }
  worldToScreen(wx, wy) {
    return { x: (wx - this.cameraX) * this.zoom, y: (wy - this.cameraY) * this.zoom };
  }
  getStrokeWidthFor(shape) {
    return shape && (shape.strokeWidth ?? this.defaultStrokeWidth);
  }
  getCanvasBgColor() {
    return document.documentElement.classList.contains("dark") ? "#0f172a" : "#ffffff";
  }
  getStrokeColorFor(shape) {
    if (!shape) return this.defaultStrokeColor;
    const color = shape.strokeColor ?? this.defaultStrokeColor;
    const isDark = document.documentElement.classList.contains("dark");
    const lower = color.toLowerCase();
    if (isDark) {
      if (lower === "black" || lower === "#000000" || lower === "#000") {
        return "#ffffff";
      }
    } else {
      if (lower === "white" || lower === "#ffffff" || lower === "#fff") {
        return "#000000";
      }
    }
    return color;
  }
  drawRoundedDiamond(ctx, cx, cy, w, h, cornerRadius) {
    const top = { x: cx, y: cy - h / 2 };
    const right = { x: cx + w / 2, y: cy };
    const bottom = { x: cx, y: cy + h / 2 };
    const left = { x: cx - w / 2, y: cy };
    const maxR = Math.min(w, h) / 2;
    const r = Math.min(Math.max(0, cornerRadius || 6), maxR);
    ctx.beginPath();
    const offset = (a, b, rlen) => {
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len = Math.hypot(vx, vy);
      if (len === 0) return { x: a.x, y: a.y };
      const ux = vx / len;
      const uy = vy / len;
      return { x: a.x + ux * rlen, y: a.y + uy * rlen };
    };
    const p1 = offset(top, right, r);
    const p2 = offset(right, bottom, r);
    const p3 = offset(bottom, left, r);
    const p4 = offset(left, top, r);
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(right.x, right.y, p2.x, p2.y);
    ctx.quadraticCurveTo(bottom.x, bottom.y, p3.x, p3.y);
    ctx.quadraticCurveTo(left.x, left.y, p4.x, p4.y);
    ctx.quadraticCurveTo(top.x, top.y, p1.x, p1.y);
    ctx.closePath();
    ctx.stroke();
  }
  clearCanvas() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.getCanvasBgColor();
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.cameraX * this.zoom, -this.cameraY * this.zoom);
    for (const stored of this.existingShapes) {
      const shape = stored.shape;
      if (!shape) continue;
      const strokeColor = this.getStrokeColorFor(shape);
      const strokeWidth = this.getStrokeWidthFor(shape);
      if (shape.type === "rect") {
        this.ctx.beginPath();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        this.ctx.closePath();
      } else if (shape.type === "circle") {
        this.ctx.beginPath();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (shape.type === "pencil") {
        this.ctx.beginPath();
        if (shape.path.length > 0) {
          this.ctx.moveTo(shape.path[0][0], shape.path[0][1]);
          for (let i = 1; i < shape.path.length; i++) this.ctx.lineTo(shape.path[i][0], shape.path[i][1]);
        }
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (shape.type === "line") {
        this.ctx.beginPath();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.moveTo(shape.startX, shape.startY);
        this.ctx.lineTo(shape.endX, shape.endY);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (shape.type === "arrow") {
        const headlen = 15;
        const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
        this.ctx.beginPath();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.moveTo(shape.startX, shape.startY);
        this.ctx.lineTo(shape.endX, shape.endY);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(shape.endX, shape.endY);
        this.ctx.lineTo(shape.endX - headlen * Math.cos(angle - Math.PI / 6), shape.endY - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(shape.endX - headlen * Math.cos(angle + Math.PI / 6), shape.endY - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.lineTo(shape.endX, shape.endY);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (shape.type === "diamond") {
        this.ctx.beginPath();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = strokeWidth;
        const cornerRadius = shape.cornerRadius ?? Math.min(shape.width, shape.height) * 0.08;
        this.drawRoundedDiamond(this.ctx, shape.centerX, shape.centerY, shape.width, shape.height, cornerRadius);
      } else if (shape.type === "text") {
        this.drawShape(shape);
      }
    }
    if (this.selectedShapeId) {
      this.selectTool.drawSelection(this.ctx, this.existingShapes);
      const stored = this.existingShapes.find((s) => s.id === this.selectedShapeId);
      if (stored) this.resizeTool.drawHandles(this.ctx, stored.shape);
    }
    this.ctx.restore();
  }
  drawShape(shape) {
    const ctx = this.ctx;
    if (!shape) return;
    const strokeColor = this.getStrokeColorFor(shape);
    const strokeWidth = shape.strokeWidth ?? this.defaultStrokeWidth;
    if (shape.type === "rect") {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === "circle") {
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "pencil") {
      ctx.beginPath();
      if (shape.path.length > 0) {
        ctx.moveTo(shape.path[0][0], shape.path[0][1]);
        for (let i = 1; i < shape.path.length; i++) ctx.lineTo(shape.path[i][0], shape.path[i][1]);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "line") {
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "arrow") {
      const headlen = 15;
      const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(shape.endX, shape.endY);
      ctx.lineTo(shape.endX - headlen * Math.cos(angle - Math.PI / 6), shape.endY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(shape.endX - headlen * Math.cos(angle + Math.PI / 6), shape.endY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "diamond") {
      const cx = shape.centerX;
      const cy = shape.centerY;
      const w = shape.width / 2;
      const h = shape.height / 2;
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.moveTo(cx, cy - h);
      ctx.lineTo(cx + w, cy);
      ctx.lineTo(cx, cy + h);
      ctx.lineTo(cx - w, cy);
      ctx.closePath();
      ctx.stroke();
    } else if (shape.type === "text") {
      ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
      ctx.fillStyle = strokeColor;
      ctx.textAlign = shape.textAlign;
      ctx.textBaseline = shape.verticalAlign === "top" ? "top" : shape.verticalAlign === "middle" ? "middle" : "bottom";
      const words = (shape.text || "").split(/\s+/);
      const lines = [];
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > shape.width && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      const lineHeightPx = shape.fontSize * shape.lineHeight;
      let startY = shape.y;
      if (shape.verticalAlign === "middle") {
        const textHeight = lines.length * lineHeightPx;
        startY = shape.y + (shape.height - textHeight) / 2;
      } else if (shape.verticalAlign === "bottom") {
        const textHeight = lines.length * lineHeightPx;
        startY = shape.y + shape.height - textHeight;
      }
      for (let i = 0; i < lines.length; i++) {
        let x = shape.x;
        if (shape.textAlign === "center") x = shape.x + shape.width / 2;
        else if (shape.textAlign === "right") x = shape.x + shape.width;
        const y = startY + i * lineHeightPx;
        ctx.fillText(lines[i], x, y);
      }
    }
  }
  setTool(tool) {
    this.selectedTool = tool;
    if (tool !== "resize" && this.resizeTool.isResizing()) this.resizeTool.finishResize();
    if (tool !== "select") {
      this.selectTool.clearSelection();
      this.selectedShapeId = null;
    }
  }
  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const cy = ev.clientY - rect.top;
        const delta = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        this.setZoom(this.zoom * delta, cx, cy);
      },
      { passive: false }
    );
  }
}
