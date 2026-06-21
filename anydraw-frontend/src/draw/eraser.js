// eraser.js

export class Eraser {
  size;

  constructor(size = 10) {
    this.size = size;
  }

  setSize(size) {
    this.size = size;
  }

  getSize() {
    return this.size;
  }

  pointToLineDistance(p, a, b) {
    const A = p.x - a.x;
    const B = p.y - a.y;
    const C = b.x - a.x;
    const D = b.y - a.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = a.x;
      yy = a.y;
    } else if (param > 1) {
      xx = b.x;
      yy = b.y;
    } else {
      xx = a.x + param * C;
      yy = a.y + param * D;
    }

    const dx = p.x - xx;
    const dy = p.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  isPointInShape(x, y, shape) {
    if (shape.type === "rect") {
      return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
    } else if (shape.type === "circle") {
      const dx = x - shape.centerX;
      const dy = y - shape.centerY;
      return Math.sqrt(dx * dx + dy * dy) <= Math.abs(shape.radius);
    } else if (shape.type === "pencil") {
      for (let i = 0; i < shape.path.length; i++) {
        const [px, py] = shape.path[i];
        const dist = Math.hypot(px - x, py - y);
        if (dist <= (shape.strokeWidth || 2) + this.size) return true;
      }
      return false;
    } else if (shape.type === "line" || shape.type === "arrow") {
      const dist = this.pointToLineDistance({ x, y }, { x: shape.startX, y: shape.startY }, { x: shape.endX, y: shape.endY });
      return dist <= this.size + 3;
    } else if (shape.type === "diamond") {
      const dx = Math.abs(x - shape.centerX);
      const dy = Math.abs(y - shape.centerY);
      return dx / (shape.width / 2) + dy / (shape.height / 2) <= 1;
    } else if (shape.type === "text") {
      return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
    }
    return false;
  }

  // returns shape id of topmost hit or null
  findShapeAt(x, y, storedShapes) {
    for (let i = storedShapes.length - 1; i >= 0; i--) {
      const s = storedShapes[i];
      if (!s || !s.shape) continue;
      if (this.isPointInShape(x, y, s.shape)) {
        return s.id;
      }
    }
    return null;
  }

  eraseById(id, storedShapes) {
    const idx = storedShapes.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    storedShapes.splice(idx, 1);
    return true;
  }

  drawPreview(ctx, sx, sy) {
    // sx,sy are screen coordinates; draw a screen-space circle
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,0,0,0.9)";
    ctx.lineWidth = 1;
    ctx.arc(sx, sy, this.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }
}
