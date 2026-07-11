/* Settings — persistent graphics/options store (LocalStorage) applied to the
 * renderer and game loop. Loaded on boot, saved on every change.
 */
const Settings = {
  key: 'deadzone_settings_v1',
  data: {
    renderDistance: 5200,   // world units of draw distance (fog + camera far)
    shadowQuality: 'high',  // off | low | medium | high
    antialias: true,        // supersample edges
    resolutionScale: 1.0,   // 0.5 – 2.0 device pixel scale
    fpsLimit: 0,            // 0 = unlimited, else target FPS
  },

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.key));
      if (s && typeof s === 'object') Object.assign(this.data, s);
    } catch (e) { /* ignore corrupt settings */ }
    return this.data;
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
  set(k, v) { this.data[k] = v; this.save(); },

  // Push every setting into the live game/renderer.
  apply(game) {
    const r = game.r3d;
    if (r) {
      r.setRenderDistance(this.data.renderDistance);
      r.setShadowQuality(this.data.shadowQuality);
      r.setResolutionScale(this.data.resolutionScale);
      r.setAntialias(this.data.antialias);
    }
    game.fpsLimit = this.data.fpsLimit;
  },
};
