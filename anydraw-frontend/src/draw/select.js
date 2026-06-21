// select.js
// Simple selection tool: hit-testing and drawing selection outlines.
// Exports SelectTool.

/**
 * Returns whether point (x,y) is inside or near shape.
 * Basic hit-tests for rect/circle/diamond/line/pencil.
 */
function pointInShape(x, y, shape, padding = 6) {
  if (shape.type === "rect") {
    return x >= shape.x - padding &&
           x <= shape.x + shape.width + padding &&
           y >= shape.y - padding &&
           y <= shape.y + shape.height + padding;
  } else if (shape.type === "circle") {
    const dx = x - shape.centerX;
    const dy = y - shape.centerY;
    return Math.hypot(dx, dy) <= Math.abs(shape.radius) + padding;
  } else if (shape.type === "diamond") {
    // bounding-box approximate
    const cx = shape.centerX;
    const cy = shape.centerY;
    const w = shape.width / 2 + padding;
    const h = shape.height / 2 + padding;
    return x >= cx - w && x <= cx + w && y >= cy - h && y <= cy + h;
  } else if (shape.type === "line" || shape.type === "arrow") {
    // distance from point to segment
    const x1 = shape.startX;
    const y1 = shape.startY;
    const x2 = shape.endX;
    const y2 = shape.endY;
    const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D;
    const len2 = C * C + D * D;
    let param = -1;
    if (len2 !== 0) param = dot / len2;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = x - xx, dy = y - yy;
    return Math.hypot(dx, dy) <= padding + (shape.strokeWidth ?? 4);
  } else if (shape.type === "pencil") {
    // bounding box of path
    const path = shape.path;
    if (!path || path.length === 0) return false;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const p of path) {
      minx = Math.min(minx, p[0]);
      maxx = Math.max(maxx, p[0]);
      miny = Math.min(miny, p[1]);
      maxy = Math.max(maxy, p[1]);
    }
    return x >= minx - padding && x <= maxx + padding && y >= miny - padding && y <= maxy + padding;
  } else if (shape.type === "text") {
    return x >= shape.x - padding && x <= shape.x + shape.width + padding && y >= shape.y - padding && y <= shape.y + shape.height + padding;
  }
  return false;
}

// compute bounding box for a shape
function bboxOf(shape) {
  if (shape.type === "rect") return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
  if (shape.type === "circle") {
    const r = Math.abs(shape.radius);
    return { x: shape.centerX - r, y: shape.centerY - r, w: 2 * r, h: 2 * r };
  }
  if (shape.type === "diamond") return { x: shape.centerX - shape.width / 2, y: shape.centerY - shape.height / 2, w: shape.width, h: shape.height };
  if (shape.type === "line" || shape.type === "arrow") {
    const x1 = shape.startX, y1 = shape.startY, x2 = shape.endX, y2 = shape.endY;
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }
  if (shape.type === "pencil") {
    const path = shape.path || [];
    if (path.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of path) {
      minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]);
    }
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  }
  if (shape.type === "text") return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
  return { x: 0, y: 0, w: 0, h: 0 };
}

// compute handle centers for bbox
function handlesFor(bbox) {
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  return {
    nw: { x: bbox.x, y: bbox.y },
    n: { x: cx, y: bbox.y },
    ne: { x: bbox.x + bbox.w, y: bbox.y },
    e: { x: bbox.x + bbox.w, y: cy },
    se: { x: bbox.x + bbox.w, y: bbox.y + bbox.h },
    s: { x: cx, y: bbox.y + bbox.h },
    sw: { x: bbox.x, y: bbox.y + bbox.h },
    w: { x: bbox.x, y: cy },
  };
}

export class SelectTool {
  selectedId = null;
  onSelect = null;
  handleSize = 10; // in world units; draw/hit area for handles

  constructor(onSelect) {
    this.onSelect = onSelect;
  }

  setOnSelect(cb) {
    this.onSelect = cb;
  }

  getSelectedId() {
    return this.selectedId;
  }

  clearSelection() {
    this.selectedId = null;
    if (this.onSelect) this.onSelect(null, { part: "none" });
  }

  /**
   * Hit-test stored shapes top-down (topmost last in array).
   * returns id or undefined (keeps backward compatibility)
   * Also calls the onSelect callback with where the user clicked: inside or on a handle.
   */
  findAt(x, y, stored) {
    for (let i = stored.length - 1; i >= 0; i--) {
      const s = stored[i];
      if (!s || !s.shape) continue;

      // check handles first
      const bbox = bboxOf(s.shape);
      const handles = handlesFor(bbox);
      const half = this.handleSize / 2;
      for (const k of Object.keys(handles)) {
        const h = handles[k];
        if (Math.abs(x - h.x) <= half && Math.abs(y - h.y) <= half) {
          this.selectedId = s.id;
          if (this.onSelect) this.onSelect(s.id, { part: "handle", handle: k });
          return s.id;
        }
      }

      // check inside
      if (pointInShape(x, y, s.shape)) {
        this.selectedId = s.id;
        if (this.onSelect) this.onSelect(s.id, { part: "inside" });
        return s.id;
      }
    }

    this.selectedId = null;
    if (this.onSelect) this.onSelect(null, { part: "none" });
    return undefined;
  }

  // draw selection UI around selected shape (if present)
  drawSelection(ctx, stored) {
    if (!this.selectedId) return;
    const s = stored.find((x) => x.id === this.selectedId);
    if (!s) return;
    const shape = s.shape;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);

    if (shape.type === "rect") {
      ctx.strokeRect(shape.x - 6, shape.y - 6, shape.width + 12, shape.height + 12);
    } else if (shape.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(shape.centerX, shape.centerY, Math.abs(shape.radius) + 6, Math.abs(shape.radius) + 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "diamond") {
      const cx = shape.centerX;
      const cy = shape.centerY;
      const w = shape.width / 2 + 6;
      const h = shape.height / 2 + 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h);
      ctx.lineTo(cx + w, cy);
      ctx.lineTo(cx, cy + h);
      ctx.lineTo(cx - w, cy);
      ctx.closePath();
      ctx.stroke();
    } else if (shape.type === "line" || shape.type === "arrow") {
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      ctx.closePath();
    } else if (shape.type === "pencil") {
      if (shape.path && shape.path.length) {
        ctx.beginPath();
        ctx.moveTo(shape.path[0][0], shape.path[0][1]);
        for (let i = 1; i < shape.path.length; i++) ctx.lineTo(shape.path[i][0], shape.path[i][1]);
        ctx.stroke();
        ctx.closePath();
      }
    } else if (shape.type === "text") {
      ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
      const words = (shape.text || "").split(/\s+/);
      let line = "";
      const lines = [];

      for (const word of words) {
        const testLine = line ? line + " " + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > shape.width && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);

      const lineHeightPx = shape.fontSize * (shape.lineHeight ?? 1.2);
      const textHeight = lines.length * lineHeightPx;

      ctx.strokeRect(
        shape.x - 6,
        shape.y - 6,
        shape.width + 12,
        textHeight + 12
      );
    }

    // draw handles (small white squares)
    const bbox = bboxOf(shape);
    const hs = handlesFor(bbox);
    ctx.setLineDash([]);
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    for (const k of Object.keys(hs)) {
      const h = hs[k];
      ctx.beginPath();
      ctx.rect(h.x - this.handleSize / 2, h.y - this.handleSize / 2, this.handleSize, this.handleSize);
      ctx.fill();
      ctx.stroke();
      ctx.closePath();
    }

    ctx.restore();
  }
}
