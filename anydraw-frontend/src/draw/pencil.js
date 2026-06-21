// pencil.js - Freehand smoothing and drawing utility

function point(x, y) {
  return [x, y];
}

function pointDistance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

// Ramer–Douglas–Peucker for simplification
function simplifyRDP(points, epsilon) {
  if (points.length < 3) return points;

  let dmax = 0;
  let index = 0;

  const lineDistance = (p, a, b) => {
    const num = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1]));
    const den = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return den === 0 ? pointDistance(p, a) : num / den;
  };

  for (let i = 1; i < points.length - 1; i++) {
    const d = lineDistance(points[i], points[0], points[points.length - 1]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const rec1 = simplifyRDP(points.slice(0, index + 1), epsilon);
    const rec2 = simplifyRDP(points.slice(index), epsilon);
    return rec1.slice(0, -1).concat(rec2);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

export class Pencil {
  points = [];
  smoothed = [];
  strokeWidth;
  strokeColor;

  constructor(strokeWidth = 2, strokeColor = "white") {
    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;
  }

  addPoint(x, y) {
    const p = point(x, y);
    if (this.points.length === 0 || pointDistance(this.points[this.points.length - 1], p) > 0.5) {
      this.points.push(p);
      this.updateSmoothed();
    }
  }

  updateSmoothed() {
    if (this.points.length < 2) {
      this.smoothed = [...this.points];
      return;
    }
    // epsilon tuned for a balance of smoothing/detail
    this.smoothed = simplifyRDP(this.points, 1.5);
  }

  getPath() {
    return this.smoothed.map((p) => [p[0], p[1]]);
  }

  getStrokeWidth() {
    return this.strokeWidth;
  }

  setStrokeWidth(w) {
    this.strokeWidth = w;
  }

  getStrokeColor() {
    return this.strokeColor;
  }

  setStrokeColor(c) {
    this.strokeColor = c;
  }

  draw(ctx) {
    if (!this.smoothed || this.smoothed.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(this.smoothed[0][0], this.smoothed[0][1]);
    for (let i = 1; i < this.smoothed.length; i++) {
      ctx.lineTo(this.smoothed[i][0], this.smoothed[i][1]);
    }
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.closePath();
  }

  reset() {
    this.points = [];
    this.smoothed = [];
  }
}
