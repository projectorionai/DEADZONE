/* Keyboard + mouse state manager. Screen-space mouse; camera converts to world. */
class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.pressed = {};       // one-frame edge triggers
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, downEdge: false };

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      // Prevent page scroll on space/arrows while playing
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { if (!this.mouse.down) this.mouse.downEdge = true; this.mouse.down = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(k) { return !!this.keys[k]; }
  // True only on the frame the key went down
  wasPressed(k) { return !!this.pressed[k]; }

  // Update world-space mouse via inverse isometric projection; call each frame.
  updateWorldMouse() {
    const w = Iso.toWorld(this.mouse.x, this.mouse.y);
    this.mouse.worldX = w.x;
    this.mouse.worldY = w.y;
  }

  // Clear one-frame edge state; call at end of frame
  endFrame() {
    this.pressed = {};
    this.mouse.downEdge = false;
  }
}
