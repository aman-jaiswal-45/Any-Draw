"use strict";
import { getExistingShapes } from "./http";
import { Pencil } from "./pencil";
import { Eraser } from "./eraser";
import { SelectTool } from "./select";
import { ResizeTool } from "./resize";
export class Game {
  constructor(canvas, roomId, socket, currentUserId) {
    this.currentUserId = currentUserId;
    this.existingShapes = [];
    this.undoStack = [];
    this.redoStack = [];
    this.activeLasers = new Map();
    this.currentUserName = "You";
    this.role = "WRITE";
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
    this.canWrite = true;
    this.isLocked = false;
    this.isHost = false;
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
      if (this.selectedTool === "laser") {
        if (this.role === "READ_ONLY") {
          return;
        }
        this.clicked = true;
        this.socket.send(JSON.stringify({
          type: "laser_move",
          roomId: this.roomId,
          x: world.x,
          y: world.y,
          userName: this.currentUserName
        }));
        this.updateLocalLaser(world.x, world.y);
        return;
      }
      if (this.canWrite === false || (this.isLocked && !this.isHost)) {
        return;
      }
      this.clicked = true;
      this.startX = world.x;
      this.startY = world.y;
      if (this.selectedTool === "pencil") {
        this.activePencil = new Pencil(this.defaultStrokeWidth, this.defaultStrokeColor);
        this.activePencil.addPoint(world.x, world.y);
        return;
      }
      if (this.selectedTool === "eraser") {
        if (!this.activeEraser) this.activeEraser = new Eraser(10);
        const erasableShapes = this.isHost ? this.existingShapes : this.existingShapes.filter((s) => s.shape && s.shape.createdBy === this.currentUserId);
        const shapeId = this.activeEraser.findShapeAt(world.x, world.y, erasableShapes);
        if (shapeId) {
          const stored = this.existingShapes.find((s) => s.id === shapeId);
          if (stored) {
            this.pushAction({ type: "delete", shapeId, shapeData: JSON.parse(JSON.stringify(stored.shape)) });
            this.existingShapes = this.existingShapes.filter((s) => s.id !== shapeId);
            this.socket.send(JSON.stringify({ type: "delete", id: shapeId, roomId: this.roomId }));
            this.clearCanvas();
            this.notifyLayersChanged();
          }
        }
        return;
      }
      if (this.selectedTool === "select") {
        const selectableShapes = this.isHost ? this.existingShapes : this.existingShapes.filter((s) => s.shape && s.shape.createdBy === this.currentUserId);
        const found = this.selectTool.findAt(screen.x, screen.y, selectableShapes);
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
        if (!this.selectedShapeId) {
          const selectableShapes = this.isHost ? this.existingShapes : this.existingShapes.filter((s) => s.shape && s.shape.createdBy === this.currentUserId);
          const found = this.selectTool.findAt(ev.offsetX, ev.offsetY, selectableShapes);
          this.selectedShapeId = found ?? null;
          this.resizeTool.setSelectedId(this.selectedShapeId);
          this.clearCanvas();
          return;
        }
        const stored = this.existingShapes.find((s) => s.id === this.selectedShapeId);
        if (!stored) return;
        const handle = this.resizeTool.hitTestHandles(ev.offsetX, ev.offsetY, stored.shape);
        if (handle) {
          this.dragOriginalShape = JSON.parse(JSON.stringify(stored.shape));
          this.resizeTool.startResize(this.selectedShapeId, stored.shape, ev.offsetX, ev.offsetY, handle);
        } else {
          const selectableShapes = this.isHost ? this.existingShapes : this.existingShapes.filter((s) => s.shape && s.shape.createdBy === this.currentUserId);
          const found = this.selectTool.findAt(ev.offsetX, ev.offsetY, selectableShapes);
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
      if (this.selectedTool === "laser" && this.clicked) {
        this.clicked = false;
        this.socket.send(JSON.stringify({
          type: "laser_stop",
          roomId: this.roomId
        }));
        this.stopLocalLaser();
        return;
      }
      if (this.isPanning) {
        this.isPanning = false;
        return;
      }
      if (this.canWrite === false || (this.isLocked && !this.isHost)) {
        return;
      }
      const screen = this.getCanvasScreenCoords(ev);
      const world = this.screenToWorld(screen.x, screen.y);
      this.clicked = false;
      if (this.isDraggingShape && this.selectedShapeId && this.dragOriginalShape) {
        const dx = world.x - this.dragStartWorld.x;
        const dy = world.y - this.dragStartWorld.y;
        if (dx !== 0 || dy !== 0) {
          const newShape = this.translateShape(this.dragOriginalShape, dx, dy);
          this.pushAction({
            type: "update",
            shapeId: this.selectedShapeId,
            oldShape: this.dragOriginalShape,
            newShape: newShape
          });
          const idx = this.existingShapes.findIndex((s) => s.id === this.selectedShapeId);
          if (idx !== -1) this.existingShapes[idx].shape = newShape;
          this.socket.send(JSON.stringify({ type: "update", id: this.selectedShapeId, shape: newShape, roomId: this.roomId }));
        }
        this.isDraggingShape = false;
        this.dragOriginalShape = null;
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (this.selectedTool === "pencil" && this.activePencil) {
        const shape = {
          type: "pencil",
          path: this.activePencil.getPath(),
          strokeWidth: this.activePencil.getStrokeWidth(),
          strokeColor: this.activePencil.getStrokeColor(),
          createdBy: this.currentUserId
        };
        const pendingId2 = `pending-${Date.now()}`;
        this.pushAction({ type: "create", shapeId: pendingId2, shapeData: shape });
        this.existingShapes.push({ id: pendingId2, shape, tempId: pendingId2 });
        this.clearCanvas();
        this.socket.send(JSON.stringify({ type: "chat", tempId: pendingId2, shape, roomId: this.roomId }));
        this.activePencil = null;
        this.notifyLayersChanged();
        return;
      }
      if (this.selectedTool === "resize" && this.resizeTool.isResizing()) {
        const newShape = this.resizeTool.applyResize(ev.offsetX, ev.offsetY);
        const id = this.resizeTool.getSelectedId();
        if (id && newShape && this.dragOriginalShape) {
          this.pushAction({
            type: "update",
            shapeId: id,
            oldShape: this.dragOriginalShape,
            newShape: newShape
          });
          const idx = this.existingShapes.findIndex((s) => s.id === id);
          if (idx !== -1) this.existingShapes[idx].shape = newShape;
          this.socket.send(JSON.stringify({ type: "update", id, shape: newShape, roomId: this.roomId }));
          this.clearCanvas();
          this.notifyLayersChanged();
        }
        this.dragOriginalShape = null;
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
        shapeToSend = { type: "rect", x: this.startX, y: this.startY, width, height, strokeWidth, strokeColor, createdBy: this.currentUserId };
      } else if (selectedTool === "circle") {
        const radius = Math.sqrt(width * width + height * height) / 2;
        shapeToSend = {
          type: "circle",
          radius,
          centerX: this.startX + width / 2,
          centerY: this.startY + height / 2,
          strokeWidth,
          strokeColor,
          createdBy: this.currentUserId
        };
      } else if (selectedTool === "line") {
        shapeToSend = { type: "line", startX: this.startX, startY: this.startY, endX: world.x, endY: world.y, strokeWidth, strokeColor, createdBy: this.currentUserId };
      } else if (selectedTool === "arrow") {
        shapeToSend = { type: "arrow", startX: this.startX, startY: this.startY, endX: world.x, endY: world.y, strokeWidth, strokeColor, createdBy: this.currentUserId };
      } else if (selectedTool === "diamond") {
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;
        const cornerRadius = Math.min(Math.abs(width), Math.abs(height)) * 0.08 || 6;
        shapeToSend = { type: "diamond", centerX, centerY, width: Math.abs(width), height: Math.abs(height), strokeWidth, strokeColor, cornerRadius, createdBy: this.currentUserId };
      } else if (selectedTool === "text") {
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
          strokeColor,
          createdBy: this.currentUserId
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
          this.pushAction({ type: "create", shapeId: pendingId2, shapeData: textShape });
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
      this.pushAction({ type: "create", shapeId: pendingId, shapeData: shapeToSend });
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
          this.activeEraser.drawPreview(this.ctx, screen.x, screen.y);
        }
        return;
      }
      if (this.selectedTool === "laser" && this.clicked) {
        this.socket.send(JSON.stringify({
          type: "laser_move",
          roomId: this.roomId,
          x: world.x,
          y: world.y,
          userName: this.currentUserName
        }));
        this.updateLocalLaser(world.x, world.y);
        return;
      }
      if (this.canWrite === false || (this.isLocked && !this.isHost)) {
        return;
      }
      if (this.selectedTool === "select" && this.isDraggingShape && this.dragOriginalShape && this.selectedShapeId) {
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
        this.activePencil.addPoint(world.x, world.y);
        this.clearCanvas();
        this.activePencil.draw(this.ctx);
        return;
      }
      if (this.selectedTool === "resize" && this.resizeTool.isResizing()) {
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
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.ctx.strokeRect(this.startX, this.startY, world.x - this.startX, world.y - this.startY);
        } else if (this.selectedTool === "circle") {
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
          this.ctx.beginPath();
          this.ctx.moveTo(this.startX, this.startY);
          this.ctx.lineTo(world.x, world.y);
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.ctx.stroke();
        } else if (this.selectedTool === "arrow") {
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
          const w = world.x - this.startX;
          const h = world.y - this.startY;
          const cx = this.startX + w / 2;
          const cy = this.startY + h / 2;
          const cornerRadius = Math.min(Math.abs(w), Math.abs(h)) * 0.08 || 6;
          this.ctx.strokeStyle = this.defaultStrokeColor;
          this.ctx.lineWidth = this.defaultStrokeWidth;
          this.drawRoundedDiamond(this.ctx, cx, cy, Math.abs(w), Math.abs(h), cornerRadius);
        } else if (this.selectedTool === "text") {
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
  pushAction(action) {
    this.undoStack.push(action);
    this.redoStack = [];
  }
  setLayersCallback(cb) {
    this.layersCallback = cb;
  }
  setStatusCallback(cb) {
    this.statusCallback = cb;
  }
  setPendingRequestsCallback(cb) {
    this.pendingRequestsCallback = cb;
  }
  setCollaboratorsCallback(cb) {
    this.collaboratorsCallback = cb;
  }
  setRoomDeletedCallback(cb) {
    this.roomDeletedCallback = cb;
  }
  setRoomLockCallback(cb) {
    this.roomLockCallback = cb;
  }
  setWritePermissionCallback(cb) {
    this.writePermissionCallback = cb;
  }
  setCanWrite(val) {
    this.canWrite = val;
    if (!val) {
      this.setTool("select");
    }
  }
  setIsHost(val) {
    this.isHost = val;
  }
  setLocked(val) {
    this.isLocked = val;
    if (val && !this.isHost) {
      this.setTool("select");
    }
  }
  approveJoin(targetUserId) {
    this.socket.send(JSON.stringify({
      type: "approve_join",
      roomId: this.roomId,
      userId: targetUserId
    }));
  }
  rejectJoin(targetUserId) {
    this.socket.send(JSON.stringify({
      type: "reject_join",
      roomId: this.roomId,
      userId: targetUserId
    }));
  }
  removeUser(targetUserId) {
    this.socket.send(JSON.stringify({
      type: "remove_user",
      roomId: this.roomId,
      userId: targetUserId
    }));
  }
  toggleWritePermission(targetUserId, role) {
    this.socket.send(JSON.stringify({
      type: "toggle_write_permission",
      roomId: this.roomId,
      userId: targetUserId,
      role: role,
      canWrite: role === "WRITE"
    }));
  }
  toggleRoomLock(isLocked) {
    this.socket.send(JSON.stringify({
      type: "toggle_room_lock",
      roomId: this.roomId,
      isLocked: isLocked
    }));
  }
  getLayers() {
    return this.existingShapes.slice();
  }
  notifyLayersChanged() {
    this.layersCallback?.(this.getLayers());
  }
  bringToFront(id) {
    if (!this.isHost) return;
    const idx = this.existingShapes.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const [item] = this.existingShapes.splice(idx, 1);
    this.existingShapes.push(item);
    this.clearCanvas();
    this.notifyLayersChanged();
    this.sendReorder();
  }
  sendToBack(id) {
    if (!this.isHost) return;
    const idx = this.existingShapes.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const [item] = this.existingShapes.splice(idx, 1);
    this.existingShapes.unshift(item);
    this.clearCanvas();
    this.notifyLayersChanged();
    this.sendReorder();
  }
  clearBoard() {
    if (!this.isHost) return;
    if (this.existingShapes.length === 0) return;
    this.pushAction({
      type: "clear",
      shapes: JSON.parse(JSON.stringify(this.existingShapes))
    });
    this.existingShapes = [];
    this.selectedShapeId = null;
    this.selectTool.clearSelection();
    this.resizeTool.finishResize();
    this.clearCanvas();
    this.notifyLayersChanged();
    this.socket.send(JSON.stringify({
      type: "clear",
      roomId: this.roomId
    }));
  }
  updateLocalLaser(x, y) {
    const laser = this.activeLasers.get(this.currentUserId) || { userName: "You", points: [] };
    laser.lastActive = Date.now();
    laser.points.push([x, y, Date.now()]);
    if (laser.points.length > 150) laser.points.shift();
    this.activeLasers.set(this.currentUserId, laser);
    this.clearCanvas();
    this.scheduleLaserFade();
  }
  stopLocalLaser() {
    this.activeLasers.delete(this.currentUserId);
    this.clearCanvas();
  }
  scheduleLaserFade() {
    if (this.laserFadeTimeout) return;
    this.laserFadeTimeout = setTimeout(() => {
      this.laserFadeTimeout = null;
      let hasActive = false;
      const now = Date.now();
      for (const [uid, laser] of this.activeLasers.entries()) {
        // Keep points less than 4000ms old, but preserve the last one so the pointer dot doesn't disappear
        laser.points = laser.points.filter((pt, index) => {
          if (index === laser.points.length - 1) return true;
          return now - pt[2] < 4000;
        });

        if (now - laser.lastActive > 8000 && laser.points.length <= 1) {
          this.activeLasers.delete(uid);
        } else {
          if (laser.points.length > 0) {
            hasActive = true;
          }
        }
      }
      this.clearCanvas();
      if (hasActive || this.activeLasers.size > 0) {
        this.scheduleLaserFade();
      }
    }, 30);
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
    while (this.undoStack.length > 0) {
      const action = this.undoStack.pop();
      if (action.type === "create") {
        const stored = this.existingShapes.find((s) => s.id === action.shapeId);
        if (!stored) {
          continue;
        }
        this.existingShapes = this.existingShapes.filter((s) => s.id !== action.shapeId);
        this.redoStack.push(action);
        this.socket.send(JSON.stringify({ type: "delete", id: action.shapeId, roomId: this.roomId }));
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      } else if (action.type === "delete") {
        this.existingShapes.push({ id: action.shapeId, shape: action.shapeData, tempId: action.shapeId });
        this.redoStack.push(action);
        this.socket.send(JSON.stringify({ type: "chat", tempId: action.shapeId, shape: action.shapeData, roomId: this.roomId }));
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      } else if (action.type === "update") {
        const stored = this.existingShapes.find((s) => s.id === action.shapeId);
        if (!stored) {
          continue;
        }
        this.existingShapes = this.existingShapes.map((s) => {
          if (s.id === action.shapeId) {
            return { ...s, shape: action.oldShape };
          }
          return s;
        });
        this.redoStack.push(action);
        this.socket.send(JSON.stringify({ type: "update", id: action.shapeId, shape: action.oldShape, roomId: this.roomId }));
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      } else if (action.type === "clear") {
        this.existingShapes = JSON.parse(JSON.stringify(action.shapes));
        this.redoStack.push(action);
        for (const s of this.existingShapes) {
          this.socket.send(JSON.stringify({
            type: "chat",
            tempId: s.id,
            shape: s.shape,
            roomId: this.roomId
          }));
        }
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      }
    }
  }
  redo() {
    while (this.redoStack.length > 0) {
      const action = this.redoStack.pop();
      if (action.type === "create") {
        this.existingShapes.push({ id: action.shapeId, shape: action.shapeData, tempId: action.shapeId });
        this.undoStack.push(action);
        this.socket.send(JSON.stringify({ type: "chat", tempId: action.shapeId, shape: action.shapeData, roomId: this.roomId }));
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      } else if (action.type === "delete") {
        const stored = this.existingShapes.find((s) => s.id === action.shapeId);
        if (!stored) {
          continue;
        }
        this.existingShapes = this.existingShapes.filter((s) => s.id !== action.shapeId);
        this.undoStack.push(action);
        this.socket.send(JSON.stringify({ type: "delete", id: action.shapeId, roomId: this.roomId }));
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      } else if (action.type === "update") {
        const stored = this.existingShapes.find((s) => s.id === action.shapeId);
        if (!stored) {
          continue;
        }
        this.existingShapes = this.existingShapes.map((s) => {
          if (s.id === action.shapeId) {
            return { ...s, shape: action.newShape };
          }
          return s;
        });
        this.undoStack.push(action);
        this.socket.send(JSON.stringify({ type: "update", id: action.shapeId, shape: action.newShape, roomId: this.roomId }));
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      } else if (action.type === "clear") {
        this.existingShapes = [];
        this.selectedShapeId = null;
        this.selectTool.clearSelection();
        this.resizeTool.finishResize();
        this.undoStack.push(action);
        this.socket.send(JSON.stringify({
          type: "clear",
          roomId: this.roomId
        }));
        this.clearCanvas();
        this.notifyLayersChanged();
        break;
      }
    }
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

      if (parsed.type === "pending_approval") {
        this.statusCallback?.("pending");
        return;
      }
      if (parsed.type === "admin_status" && parsed.status === "offline") {
        this.statusCallback?.("offline");
        return;
      }
      if (parsed.type === "join_approved") {
        this.statusCallback?.("approved");
        if (parsed.role !== undefined) {
          this.role = parsed.role;
          this.setCanWrite(parsed.role === "WRITE");
          this.writePermissionCallback?.(parsed.role === "WRITE", parsed.role);
        } else if (parsed.canWrite !== undefined) {
          this.role = parsed.canWrite ? "WRITE" : "READ_ONLY";
          this.setCanWrite(parsed.canWrite);
          this.writePermissionCallback?.(parsed.canWrite, this.role);
        }
        if (parsed.isLocked !== undefined) {
          this.setLocked(parsed.isLocked);
          this.roomLockCallback?.(parsed.isLocked);
        }
        const serverShapes = parsed.shapes || [];
        this.existingShapes = serverShapes.map((s) => ({
          id: String(s.id),
          shape: s.shape
        }));
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (parsed.type === "join_rejected") {
        this.socket.isTerminal = true;
        this.statusCallback?.("rejected");
        return;
      }
      if (parsed.type === "admin_pending_requests") {
        this.pendingRequestsCallback?.(parsed.requests || []);
        return;
      }
      if (parsed.type === "join_request") {
        this.pendingRequestsCallback?.((prev) => {
          const prevList = Array.isArray(prev) ? prev : [];
          if (prevList.some((r) => r.userId === parsed.userId)) return prevList;
          return [...prevList, { userId: parsed.userId, userName: parsed.userName, userEmail: parsed.userEmail }];
        });
        return;
      }
      if (parsed.type === "collaborators_list") {
        const list = parsed.collaborators || [];
        const me = list.find((c) => c.userId === this.currentUserId);
        if (me) this.currentUserName = me.userName;
        this.collaboratorsCallback?.(list);
        return;
      }
      if (parsed.type === "room_deleted") {
        this.socket.isTerminal = true;
        this.roomDeletedCallback?.();
        return;
      }
      if (parsed.type === "user_removed") {
        this.socket.isTerminal = true;
        this.statusCallback?.("removed");
        return;
      }
      if (parsed.type === "write_permission_changed") {
        if (parsed.role !== undefined) {
          this.role = parsed.role;
          this.setCanWrite(parsed.role === "WRITE");
          this.writePermissionCallback?.(parsed.role === "WRITE", parsed.role);
        } else if (parsed.canWrite !== undefined) {
          this.role = parsed.canWrite ? "WRITE" : "READ_ONLY";
          this.setCanWrite(parsed.canWrite);
          this.writePermissionCallback?.(parsed.canWrite, this.role);
        }
        return;
      }
      if (parsed.type === "room_lock_changed") {
        this.setLocked(parsed.isLocked);
        this.roomLockCallback?.(parsed.isLocked);
        return;
      }
      if (parsed.type === "clear") {
        this.existingShapes = [];
        this.selectedShapeId = null;
        this.selectTool.clearSelection();
        this.resizeTool.finishResize();
        this.clearCanvas();
        this.notifyLayersChanged();
        return;
      }
      if (parsed.type === "laser_move") {
        const uid = parsed.userId;
        const laser = this.activeLasers.get(uid) || { userName: parsed.userName, points: [] };
        laser.lastActive = Date.now();
        laser.points.push([parsed.x, parsed.y, Date.now()]);
        if (laser.points.length > 150) laser.points.shift();
        this.activeLasers.set(uid, laser);
        this.clearCanvas();
        this.scheduleLaserFade();
        return;
      }
      if (parsed.type === "laser_stop") {
        this.activeLasers.delete(parsed.userId);
        this.clearCanvas();
        return;
      }

      if (parsed.type === "room_state" || parsed.type === "undo" || parsed.type === "redo") {
        if (parsed.type === "room_state") {
          this.statusCallback?.("approved");
          if (parsed.role !== undefined) {
            this.role = parsed.role;
            this.setCanWrite(parsed.role === "WRITE");
            this.writePermissionCallback?.(parsed.role === "WRITE", parsed.role);
          } else if (parsed.canWrite !== undefined) {
            this.role = parsed.canWrite ? "WRITE" : "READ_ONLY";
            this.setCanWrite(parsed.canWrite);
            this.writePermissionCallback?.(parsed.canWrite, this.role);
          }
          if (parsed.isLocked !== undefined) {
            this.setLocked(parsed.isLocked);
            this.roomLockCallback?.(parsed.isLocked);
          }
        }
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
            // Update action stacks mapped to tempId
            for (const action of this.undoStack) {
              if (action.shapeId === tempId) action.shapeId = serverId;
            }
            for (const action of this.redoStack) {
              if (action.shapeId === tempId) action.shapeId = serverId;
            }
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
    // Draw lasers
    const now = Date.now();
    for (const [uid, laser] of this.activeLasers.entries()) {
      if (laser.points && laser.points.length > 0) {
        const lastPt = laser.points[laser.points.length - 1];
        
        // Render tail segments with a gradient opacity fade out and thicker stroke width
        if (laser.points.length > 1) {
          // Draw a soft glowing outer under-layer for the tail first (glow effect)
          this.ctx.save();
          this.ctx.shadowBlur = 12;
          this.ctx.shadowColor = "rgba(239, 68, 68, 0.65)";
          for (let i = 1; i < laser.points.length; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(laser.points[i - 1][0], laser.points[i - 1][1]);
            this.ctx.lineTo(laser.points[i][0], laser.points[i][1]);
            
            // Age-based fade out and tapering
            const age = now - laser.points[i][2];
            const lifeRatio = Math.max(0, Math.min(1, 1 - age / 4000));
            const opacity = lifeRatio * 0.22;
            
            this.ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`;
            this.ctx.lineWidth = lifeRatio * 14; // Wider glow tail
            this.ctx.lineCap = "round";
            this.ctx.lineJoin = "round";
            this.ctx.stroke();
            this.ctx.closePath();
          }
          this.ctx.restore();

          // Draw the sharp core tail layer on top
          for (let i = 1; i < laser.points.length; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(laser.points[i - 1][0], laser.points[i - 1][1]);
            this.ctx.lineTo(laser.points[i][0], laser.points[i][1]);
            
            const age = now - laser.points[i][2];
            const lifeRatio = Math.max(0, Math.min(1, 1 - age / 4000));
            const opacity = lifeRatio * 0.85;
            
            this.ctx.strokeStyle = `rgba(255, 60, 60, ${opacity})`;
            this.ctx.lineWidth = lifeRatio * 7; // Thinner core tail
            this.ctx.lineCap = "round";
            this.ctx.lineJoin = "round";
            this.ctx.stroke();
            this.ctx.closePath();
          }
        }
        
        // Multi-layered glowing pointer dot (outer diffuse, middle hot glow, inner solid core)
        this.ctx.save();
        this.ctx.shadowBlur = 14;
        this.ctx.shadowColor = "rgba(239, 68, 68, 0.9)";

        // Outer glow
        this.ctx.beginPath();
        this.ctx.arc(lastPt[0], lastPt[1], 22, 0, Math.PI * 2);
        this.ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
        this.ctx.fill();
        this.ctx.closePath();

        // Middle glow
        this.ctx.beginPath();
        this.ctx.arc(lastPt[0], lastPt[1], 13, 0, Math.PI * 2);
        this.ctx.fillStyle = "rgba(239, 68, 68, 0.28)";
        this.ctx.fill();
        this.ctx.closePath();

        // Red core
        this.ctx.beginPath();
        this.ctx.arc(lastPt[0], lastPt[1], 6.5, 0, Math.PI * 2);
        this.ctx.fillStyle = "#ef4444";
        this.ctx.fill();
        this.ctx.closePath();

        this.ctx.restore();

        // White hot center (drawn without shadow blur to stay sharp)
        this.ctx.beginPath();
        this.ctx.arc(lastPt[0], lastPt[1], 3.0, 0, Math.PI * 2);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fill();
        this.ctx.closePath();

        // User label text
        this.ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
        this.ctx.font = "bold 11px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillText(laser.userName, lastPt[0], lastPt[1] - 18);
      }
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
