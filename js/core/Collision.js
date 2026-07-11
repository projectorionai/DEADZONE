/* Collision resolution against static world rects (buildings/obstacles).
 * Entities are circles; world colliders are AABBs.
 */
const Collision = {
  // Resolve a circle against a list of solid rects, mutating {x,y}.
  resolveCircle(pos, radius, solids) {
    for (const s of solids) {
      const info = Utils.circleRect(pos.x, pos.y, radius, s.x, s.y, s.w, s.h);
      if (!info.hit) continue;
      let { dx, dy } = info;
      let d = Math.hypot(dx, dy);
      if (d === 0) {
        // Center inside rect: push out along smallest axis
        const leftPen = pos.x - s.x, rightPen = (s.x + s.w) - pos.x;
        const topPen = pos.y - s.y, botPen = (s.y + s.h) - pos.y;
        const minX = Math.min(leftPen, rightPen);
        const minY = Math.min(topPen, botPen);
        if (minX < minY) pos.x += (leftPen < rightPen ? -minX - radius : minX + radius);
        else pos.y += (topPen < botPen ? -minY - radius : minY + radius);
        continue;
      }
      const overlap = radius - d;
      pos.x += (dx / d) * overlap;
      pos.y += (dy / d) * overlap;
    }
  },

  // Segment (ray) vs circle — used for bullet hit testing. Returns t in [0,1] or -1.
  raySegCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a);
    const t2 = (-b + disc) / (2 * a);
    if (t1 >= 0 && t1 <= 1) return t1;
    if (t2 >= 0 && t2 <= 1) return t2;
    return -1;
  },

  // Does segment intersect any solid rect (line-of-sight block for bullets)?
  segBlocked(x1, y1, x2, y2, solids) {
    for (const s of solids) {
      if (Collision.segRect(x1, y1, x2, y2, s.x, s.y, s.w, s.h)) return true;
    }
    return false;
  },

  segRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Quick reject then edge tests
    if (Utils.pointRect(x1, y1, rx, ry, rw, rh)) return true;
    if (Utils.pointRect(x2, y2, rx, ry, rw, rh)) return true;
    return (
      Collision.segSeg(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
      Collision.segSeg(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) ||
      Collision.segSeg(x1, y1, x2, y2, rx + rw, ry + rh, rx, ry + rh) ||
      Collision.segSeg(x1, y1, x2, y2, rx, ry + rh, rx, ry)
    );
  },

  segSeg(x1, y1, x2, y2, x3, y3, x4, y4) {
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (d === 0) return false;
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
    const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  },
};
