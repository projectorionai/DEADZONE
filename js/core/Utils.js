/* Math / geometry / RNG helpers. */
const Utils = {
  clamp(v, min, max) { return v < min ? min : v > max ? max : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(min, max) { return min + Math.random() * (max - min); },
  randFloat(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); },
  chance(p) { return Math.random() < p; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.hypot(dx, dy); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },

  // Weighted random pick from [{w:..}, ...]; returns the entry
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e.w;
    let r = Math.random() * total;
    for (const e of entries) { r -= e.w; if (r <= 0) return e; }
    return entries[entries.length - 1];
  },

  // AABB overlap
  aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  },

  // Circle vs AABB (rect x,y,w,h). Returns nearest point + whether overlapping.
  circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Utils.clamp(cx, rx, rx + rw);
    const ny = Utils.clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    return { hit: dx * dx + dy * dy < r * r, nx, ny, dx, dy };
  },

  // Point in rect
  pointRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  },

  uid() { return Math.random().toString(36).slice(2, 10); },
  now() { return performance.now(); },
};
