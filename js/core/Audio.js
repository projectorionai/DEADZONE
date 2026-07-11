/* GameAudio — procedural WebAudio SFX + ambient. No asset files needed.
 * Browsers require a user gesture before audio can start, so ensure() is called
 * on the first mouse click (wired in Game).
 *
 * Every gun archetype has its own voice (w.sfx): pistols snap, revolvers boom,
 * SMGs chatter, shotguns thump, snipers thunder, the minigun hammers.
 * Zombies vocalise per-type (cfg.voice). A two-tone air-raid siren runs during
 * outpost sieges, and a slow, ominous Dead Frontier-style music bed plays
 * inside building instances.
 */
class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._siren = null;
    this._music = null;
    this._rainNode = null;
  }

  ensure() {
    if (this.ctx || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this._noise = this._makeNoise(2.0);
    this._startAmbient();
  }

  _makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Pleasant-but-sinister bed: a deep drone + slow filtered wind that breathes.
  _startAmbient() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 52;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine'; osc2.frequency.value = 52 * 1.5 + 0.7;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.028;
    osc.connect(droneGain); osc2.connect(droneGain); droneGain.connect(this.master);
    osc.start(); osc2.start();
    const wind = ctx.createBufferSource();
    wind.buffer = this._noise; wind.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 0.6;
    const windGain = ctx.createGain(); windGain.gain.value = 0.03;
    wind.connect(lp); lp.connect(windGain); windGain.connect(this.master);
    wind.start();
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.05;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 130;
    lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency);
    lfo.start();
  }

  // ---------------- Weapons ----------------
  // Per-archetype gunshot voices. Falls back to a noise burst shaped by w.noise.
  gunshot(w) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (w && w.sfx) {
      case 'pistol':   return this._shot(t, { vol: 0.22, lo: 2400, decay: 0.09, thump: 150, thumpVol: 0.10 });
      case 'revolver': return this._shot(t, { vol: 0.32, lo: 1500, decay: 0.16, thump: 95,  thumpVol: 0.22 });
      case 'smg':      return this._shot(t, { vol: 0.16, lo: 2800, decay: 0.06, thump: 180, thumpVol: 0.06 });
      case 'rifle':    return this._shot(t, { vol: 0.26, lo: 2000, decay: 0.11, thump: 120, thumpVol: 0.14, crack: true });
      case 'sniper':   return this._shot(t, { vol: 0.4,  lo: 900,  decay: 0.30, thump: 70,  thumpVol: 0.30, crack: true });
      case 'shotgun':  return this._shot(t, { vol: 0.36, lo: 750,  decay: 0.22, thump: 62,  thumpVol: 0.30 });
      case 'heavy':    return this._shot(t, { vol: 0.2,  lo: 1300, decay: 0.08, thump: 100, thumpVol: 0.12 });
      case 'launcher': return this._shot(t, { vol: 0.3,  lo: 500,  decay: 0.24, thump: 55,  thumpVol: 0.34 });
      case 'flame': {
        // gas-jet whoosh
        const src = this.ctx.createBufferSource();
        src.buffer = this._noise; src.playbackRate.value = 0.55;
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6; bp.frequency.value = 700;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.09, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        src.connect(bp); bp.connect(g); g.connect(this.master);
        src.start(t); src.stop(t + 0.2);
        return;
      }
    }
    const loud = Utils.clamp(((w && w.noise) || 500) / 1200, 0.25, 1);
    this._shot(t, { vol: 0.08 + 0.3 * loud, lo: 2600 - 1500 * loud, decay: 0.06 + 0.14 * loud, thump: 110, thumpVol: 0.1 * loud });
  }

  // One gunshot = filtered noise burst + low sine thump (+ optional crack tail)
  _shot(t, o) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(o.lo, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.04 + o.decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + o.decay);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.4);
    // body thump
    if (o.thumpVol) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(o.thump, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(34, o.thump * 0.45), t + 0.1);
      const og = ctx.createGain();
      og.gain.setValueAtTime(o.thumpVol, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.14 + o.decay * 0.6);
      osc.connect(og); og.connect(this.master);
      osc.start(t); osc.stop(t + 0.3 + o.decay);
    }
    // supersonic crack tail for rifles
    if (o.crack) {
      const c = ctx.createBufferSource();
      c.buffer = this._noise; c.playbackRate.value = 1.6;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(o.vol * 0.5, t + 0.005);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      c.connect(hp); hp.connect(cg); cg.connect(this.master);
      c.start(t); c.stop(t + 0.1);
    }
  }

  reload() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // two metallic clicks
    for (const [dt, f] of [[0, 1900], [0.12, 1400]]) {
      const osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.035, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.03);
      osc.connect(g); g.connect(this.master);
      osc.start(t + dt); osc.stop(t + dt + 0.05);
    }
  }

  swing() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.6;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.15);
  }

  // ---------------- Zombies ----------------
  // kind: 'idle' | 'aggro' | 'hit'. Voice/pitch vary by enemy type & size.
  zombie(kind, cfg, vol = 1) {
    if (!this.ctx || vol <= 0.03) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const r = (cfg && cfg.radius) || 15;
    const voice = (cfg && cfg.voice) || 'moan';
    const sizePitch = Math.max(0.45, Math.min(1.5, 1 - (r - 13) / 42));
    const voiceMod = { moan: 1, hiss: 1.5, rasp: 1.25, gurgle: 0.75, roar: 0.55, shriek: 1.9 }[voice] || 1;
    const base = (kind === 'hit' ? 200 : kind === 'aggro' ? 150 : 95) * sizePitch * voiceMod;
    const dur = (kind === 'hit' ? 0.16 : kind === 'aggro' ? 0.55 : 0.7) * (voice === 'roar' ? 1.5 : 1);
    const peak = (kind === 'hit' ? 0.18 : kind === 'aggro' ? 0.14 : 0.08) * vol * (voice === 'roar' ? 1.4 : 1);

    const osc = ctx.createOscillator();
    osc.type = kind === 'hit' ? 'square' : (voice === 'hiss' || voice === 'shriek' ? 'triangle' : 'sawtooth');
    osc.frequency.setValueAtTime(base * (kind === 'aggro' ? 1.35 : 1), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, base * (voice === 'shriek' ? 1.6 : 0.55)), t + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.1; bp.frequency.value = base * 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(bp); bp.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);

    // wet noise growl layer
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.4 + sizePitch * 0.35;
    const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = base * 4.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(peak * 0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(nlp); nlp.connect(ng); ng.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // Kept for compatibility with older call sites.
  zombieAlertShriek(type) { this.zombie('aggro', ENEMIES[type], 0.8); }
  zombieAttackGrunt(type) { this.zombie('hit', ENEMIES[type], 0.7); }

  // ---------------- Ability / event one-shots ----------------
  scream() {   // Screamer wail — long rising shriek
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
    osc.frequency.exponentialRampToValueAtTime(700, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.value = 1100;
    osc.connect(bp); bp.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 1.3);
  }

  explosion() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.7);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.3, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(og); og.connect(this.master);
    osc.start(t); osc.stop(t + 0.6);
  }

  slam() { this.explosion(); }
  charge() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.45;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(120, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.6);
  }
  leap() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.8;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1300, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.2);
  }
  spit() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.25);
  }
  splat() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.3);
  }
  boneCrack() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [dt, rate] of [[0, 1.9], [0.05, 1.4]]) {
      const src = ctx.createBufferSource();
      src.buffer = this._noise; src.playbackRate.value = rate;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.05);
      src.connect(hp); hp.connect(g); g.connect(this.master);
      src.start(t + dt); src.stop(t + dt + 0.08);
    }
  }
  geiger() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const dt = i * 0.05 + Math.random() * 0.03;
      const osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.02, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.015);
      osc.connect(g); g.connect(this.master);
      osc.start(t + dt); osc.stop(t + dt + 0.03);
    }
  }
  thunder() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 1.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 2);
  }
  bossWarning() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 1.5);
  }
  levelUp() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [392, 523, 659, 784].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.24);
      osc.connect(g); g.connect(this.master);
      osc.start(t + i * 0.09); osc.stop(t + i * 0.09 + 0.3);
    });
  }

  // ---------------- Spitter acid ----------------
  acidWindup() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 1);
  }
  acidSpray() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.playbackRate.value = 0.7;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.6);
  }

  // Hit-marker tick — crunchy feedback on every landed shot.
  hitTick(crit) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = crit ? 1600 : 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(crit ? 0.05 : 0.03, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.04);
  }

  // ---------------- Ambient horror stingers ----------------
  // Random distant dread — screams, gunfire, creaking metal, electrical buzz.
  // `intensity` (0..1, from the district) scales volume and menace.
  stinger(kind, intensity = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const vol = 0.02 + intensity * 0.05;
    if (kind === 'scream') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 1.4);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      osc.connect(lp); lp.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 1.7);
    } else if (kind === 'gunfire') {
      // a distant burst of 3-6 muffled shots
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const dt2 = i * (0.09 + Math.random() * 0.05);
        const src = ctx.createBufferSource();
        src.buffer = this._noise; src.playbackRate.value = 0.5;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol * 0.8, t + dt2);
        g.gain.exponentialRampToValueAtTime(0.001, t + dt2 + 0.08);
        src.connect(lp); lp.connect(g); g.connect(this.master);
        src.start(t + dt2); src.stop(t + dt2 + 0.12);
      }
    } else if (kind === 'creak') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.linearRampToValueAtTime(90 + Math.random() * 60, t + 1.8);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2);
      osc.connect(bp); bp.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 2.1);
    } else if (kind === 'buzz') {
      const osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = 58;
      const g = ctx.createGain();
      for (let i = 0; i < 6; i++) {
        const bt = t + i * 0.14;
        g.gain.setValueAtTime(Math.random() < 0.5 ? vol * 0.5 : 0.001, bt);
      }
      g.gain.setValueAtTime(0.001, t + 0.9);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 1);
    }
  }

  // ---------------- Siege siren ----------------
  // Classic rising/falling air-raid siren, loops until stopped.
  sirenStart() {
    if (!this.ctx || this._siren) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 420;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.4;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt); lfoAmt.connect(osc.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 1.2);
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(); lfo.start();
    this._siren = { osc, lfo, g };
  }
  sirenStop() {
    if (!this.ctx || !this._siren) return;
    const s = this._siren, t = this.ctx.currentTime;
    s.g.gain.cancelScheduledValues(t);
    s.g.gain.setValueAtTime(s.g.gain.value, t);
    s.g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
    const osc = s.osc, lfo = s.lfo;
    setTimeout(() => { try { osc.stop(); lfo.stop(); } catch (e) { } }, 1700);
    this._siren = null;
  }

  // ---------------- Instance music ----------------
  // Ominous DF1-style bed: slow minor arpeggio over a detuned pad, looped by timer.
  musicStart() {
    if (!this.ctx || this._music) return;
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5);
    bus.connect(this.master);
    // pad: two detuned saws through a dark lowpass
    const padA = ctx.createOscillator(); padA.type = 'sawtooth'; padA.frequency.value = 55;   // A1
    const padB = ctx.createOscillator(); padB.type = 'sawtooth'; padB.frequency.value = 55 * 1.007;
    const padLp = ctx.createBiquadFilter(); padLp.type = 'lowpass'; padLp.frequency.value = 320; padLp.Q.value = 0.7;
    const padG = ctx.createGain(); padG.gain.value = 0.5;
    padA.connect(padLp); padB.connect(padLp); padLp.connect(padG); padG.connect(bus);
    padA.start(); padB.start();
    // slow arpeggio: A minor w/ occasional dissonant Bb — pure dread
    const notes = [110, 130.81, 164.81, 220, 164.81, 130.81, 116.54, 130.81];
    let step = 0;
    const tick = () => {
      if (!this._music) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[step % notes.length] * (Math.random() < 0.08 ? 0.5 : 1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      osc.connect(g); g.connect(bus);
      osc.start(t); osc.stop(t + 3.6);
      step++;
      this._music.timer = setTimeout(tick, 1700 + Math.random() * 900);
    };
    this._music = { bus, padA, padB, timer: null };
    tick();
  }
  musicStop() {
    if (!this.ctx || !this._music) return;
    const m = this._music, t = this.ctx.currentTime;
    clearTimeout(m.timer);
    m.bus.gain.cancelScheduledValues(t);
    m.bus.gain.setValueAtTime(m.bus.gain.value, t);
    m.bus.gain.linearRampToValueAtTime(0.0001, t + 2);
    const padA = m.padA, padB = m.padB;
    setTimeout(() => { try { padA.stop(); padB.stop(); } catch (e) { } }, 2200);
    this._music = null;
  }

  // ---------------- Weather ----------------
  rainSet(intensity) {
    if (!this.ctx) return;
    if (intensity > 0.05 && !this._rainNode) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this._noise; src.loop = true; src.playbackRate.value = 1.1;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(hp); hp.connect(g); g.connect(this.master);
      src.start();
      this._rainNode = { src, g };
    }
    if (this._rainNode) {
      const t = this.ctx.currentTime;
      this._rainNode.g.gain.cancelScheduledValues(t);
      this._rainNode.g.gain.setValueAtTime(this._rainNode.g.gain.value, t);
      this._rainNode.g.gain.linearRampToValueAtTime(0.05 * intensity, t + 1.5);
    }
  }
}
