// resize.js
// ResizeTool manages resizing a selected shape via handles (8 handles).

export class ResizeTool {
  activeHandle = null;
  startPointer = null;
  originalShape = null;
  selectedId = null;
  handleSize = 12; // pixels: the drawn square handle is handleSize x handleSize

  // compute bounding box for a shape (x,y,w,h)
  bbox(shape) {
    if (shape.type === "rect") {
      return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
    } else if (shape.type === "circle") {
      const r = Math.abs(shape.radius);
      return { x: shape.centerX - r, y: shape.centerY - r, w: 2 * r, h: 2 * r };
    } else if (shape.type === "diamond") {
      return { x: shape.centerX - shape.width / 2, y: shape.centerY - shape.height / 2, w: shape.width, h: shape.height };
    } else if (shape.type === "text") {
      return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
    } else if (shape.type === "line" || shape.type === "arrow") {
      const x1 = shape.startX, y1 = shape.startY, x2 = shape.endX, y2 = shape.endY;
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    } else if (shape.type === "pencil") {
      const path = shape.path || [];
      if (path.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (const p of path) {
        minx = Math.min(minx, p[0]);
        maxx = Math.max(maxx, p[0]);
        miny = Math.min(miny, p[1]);
        maxy = Math.max(maxy, p[1]);
      }
      return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  // compute handle centers for bbox
  handlesFor(bbox) {
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

  // returns which handle (if any) contains point (x,y)
  hitTestHandles(x, y, shape) {
    const bbox = this.bbox(shape);
    const handles = this.handlesFor(bbox);
    const half = this.handleSize / 2;
    for (const k of Object.keys(handles)) {
      const h = handles[k];
      if (Math.abs(x - h.x) <= half && Math.abs(y - h.y) <= half) return k;
    }
    return null;
  }

  startResize(id, shape, pointerX, pointerY, handle) {
    this.activeHandle = handle;
    this.startPointer = { x: pointerX, y: pointerY };
    this.originalShape = JSON.parse(JSON.stringify(shape));
    this.selectedId = id;
  }

  computeNewBBoxFromHandle(origBBox, handle, dx, dy) {
    let left = origBBox.x;
    let top = origBBox.y;
    let right = origBBox.x + origBBox.w;
    let bottom = origBBox.y + origBBox.h;

    switch (handle) {
      case "nw":
        left += dx; top += dy; break;
      case "n":
        top += dy; break;
      case "ne":
        right += dx; top += dy; break;
      case "e":
        right += dx; break;
      case "se":
        right += dx; bottom += dy; break;
      case "s":
        bottom += dy; break;
      case "sw":
        left += dx; bottom += dy; break;
      case "w":
        left += dx; break;
    }

    // enforce min size
    const minSize = 6;
    if (right - left < minSize) {
      if (handle === "nw" || handle === "w" || handle === "sw") {
        left = right - minSize;
      } else {
        right = left + minSize;
      }
    }
    if (bottom - top < minSize) {
      if (handle === "nw" || handle === "n" || handle === "ne") {
        top = bottom - minSize;
      } else {
        bottom = top + minSize;
      }
    }

    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  applyResize(pointerX, pointerY) {
    if (!this.activeHandle || !this.startPointer || !this.originalShape) return null;
    const dx = pointerX - this.startPointer.x;
    const dy = pointerY - this.startPointer.y;
    const s = JSON.parse(JSON.stringify(this.originalShape));

    const origBBox = this.bbox(this.originalShape);

    if (s.type === "rect") {
      const newBBox = this.computeNewBBoxFromHandle(origBBox, this.activeHandle, dx, dy);
      s.x = newBBox.x;
      s.y = newBBox.y;
      s.width = Math.max(6, newBBox.w);
      s.height = Math.max(6, newBBox.h);
      return s;
    } else if (s.type === "circle") {
      const newBBox = this.computeNewBBoxFromHandle(origBBox, this.activeHandle, dx, dy);
      let size;
      if (this.activeHandle === "e" || this.activeHandle === "w") {
        size = newBBox.w;
      } else if (this.activeHandle === "n" || this.activeHandle === "s") {
        size = newBBox.h;
      } else {
        size = Math.min(newBBox.w, newBBox.h);
      }
      size = Math.max(size, 6);
      const cx = newBBox.x + newBBox.w / 2;
      const cy = newBBox.y + newBBox.h / 2;
      s.centerX = cx;
      s.centerY = cy;
      s.radius = Math.max(3, size / 2);
      return s;
    } else if (s.type === "diamond") {
      const newBBox = this.computeNewBBoxFromHandle(origBBox, this.activeHandle, dx, dy);
      s.width = Math.max(6, newBBox.w);
      s.height = Math.max(6, newBBox.h);
      s.centerX = newBBox.x + newBBox.w / 2;
      s.centerY = newBBox.y + newBBox.h / 2;
      return s;
    } else if (s.type === "line" || s.type === "arrow") {
      const leftHandles = new Set(["nw", "w", "sw"]);
      const rightHandles = new Set(["ne", "e", "se"]);
      if (leftHandles.has(this.activeHandle)) {
        s.startX += dx;
        s.startY += dy;
      } else if (rightHandles.has(this.activeHandle)) {
        s.endX += dx;
        s.endY += dy;
      } else {
        const startY = this.originalShape.startY;
        const endY = this.originalShape.endY;
        if (Math.abs(startY - origBBox.y) < Math.abs(endY - origBBox.y)) {
          s.startX += dx; s.startY += dy;
        } else {
          s.endX += dx; s.endY += dy;
        }
      }
      return s;
    } else if (s.type === "text") {
      const newBBox = this.computeNewBBoxFromHandle(origBBox, this.activeHandle, dx, dy);
      s.x = newBBox.x;
      s.y = newBBox.y;
      s.width = Math.max(30, newBBox.w);
      if (  this.activeHandle === "n" || this.activeHandle === "s" ||
            this.activeHandle === "nw" || this.activeHandle === "ne" ||
            this.activeHandle === "sw" || this.activeHandle === "se"
          ) {
            const scaleY = newBBox.h / origBBox.h;
            const newFontSize = Math.max(8, (s.fontSize || 16) * scaleY);
            s.fontSize = newFontSize;
          }
      
      if (s.text) {
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.font = `${s.fontSize}px ${s.fontFamily}`;
        const hardLines = s.text.split("\n");
        const lines = [];
        for (const hardLine of hardLines) {
          const words = hardLine.split(" ");
          let currentLine = "";
          for (const word of words) {
            const testLine = currentLine ? currentLine + " " + word : word;
            if (ctx.measureText(testLine).width > s.width && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
        }

        const lineHeightPx = (s.fontSize || 12) * (s.lineHeight || 1.2);
        s.height = lines.length * lineHeightPx;
      } else {
        s.height = Math.max(20, newBBox.h);
      }
      return s;
    } else if (s.type === "pencil") {
      const origW = origBBox.w || 1;
      const origH = origBBox.h || 1;
      const newBBox = this.computeNewBBoxFromHandle(origBBox, this.activeHandle, dx, dy);
      const scaleX = newBBox.w / origW;
      const scaleY = newBBox.h / origH;
      const cx = origBBox.x + origBBox.w / 2;
      const cy = origBBox.y + origBBox.h / 2;

      const newCx = newBBox.x + newBBox.w / 2;
      const newCy = newBBox.y + newBBox.h / 2;

      const newPath = (s.path || []).map((p) => {
        const sx = ((p[0] - cx) * scaleX) + newCx;
        const sy = ((p[1] - cy) * scaleY) + newCy;
        return [sx, sy];
      });
      s.path = newPath;
      return s;
    }
    return null;
  }

  drawHandles(ctx, shape) {
    const bbox = this.bbox(shape);
    const handles = this.handlesFor(bbox);
    ctx.save();
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    const half = this.handleSize / 2;
    for (const k of Object.keys(handles)) {
      const h = handles[k];
      ctx.beginPath();
      ctx.rect(h.x - half, h.y - half, this.handleSize, this.handleSize);
      ctx.fill();
      ctx.stroke();
      ctx.closePath();
    }
    ctx.restore();
  }

  finishResize() {
    this.activeHandle = null;
    this.startPointer = null;
    this.originalShape = null;
    this.selectedId = null;
  }

  isResizing() {
    return this.activeHandle !== null;
  }

  getSelectedId() { return this.selectedId; }
  setSelectedId(id) { this.selectedId = id; }
}
