/* UI: HUD bars + toast + modal windows (inventory / trader / character / storage
 * / death). Windows are DOM overlays; the inventory grid supports HTML5 drag &
 * drop for reordering and storage transfer. Left-click uses/equips items.
 */
class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      health: document.getElementById('healthFill'),
      stamina: document.getElementById('staminaFill'),
      xp: document.getElementById('xpFill'),
      healthText: document.getElementById('healthText'),
      staminaText: document.getElementById('staminaText'),
      xpText: document.getElementById('xpText'),
      level: document.getElementById('levelText'),
      currency: document.getElementById('currencyText'),
      weapon: document.getElementById('weaponText'),
      weight: document.getElementById('weightText'),
      kills: document.getElementById('killsText'),
      usernameHud: document.getElementById('usernameHud'),
      toast: document.getElementById('toast'),
      windows: document.getElementById('windows'),
      inventoryWindow: document.getElementById('inventoryWindow'),
      traderWindow: document.getElementById('traderWindow'),
      characterWindow: document.getElementById('characterWindow'),
      storageWindow: document.getElementById('storageWindow'),
      deathScreen: document.getElementById('deathScreen'),
      tooltip: document.getElementById('tooltip'),
    };
    this.toastTimer = null;
    this._dragCtx = null;
    this._wireStaticButtons();
    this._wireTooltip();
    this._wirePause();
    this._wireAdmin();
    this._wireEquipment();
    this._wireMarket();
    this._wireHudButtons();
  }

  // HUD shortcut buttons: Inventory / Talents / Missions / Market / Armour
  _wireHudButtons() {
    document.querySelectorAll('[data-open]').forEach(b =>
      b.addEventListener('click', () => this.game.toggleState(b.dataset.open)));
  }

  // ---------- Equipment doll ----------
  _wireEquipment() {
    // Armor slots: drop to equip, click to unequip
    document.querySelectorAll('.eslot[data-armor]').forEach(el => {
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('dragover');
        const d = this._dragCtx; if (!d) return;
        const s = d.inv.slots[d.index]; if (!s) return;
        const it = ITEMS[s.id];
        const def = it && it.armorId ? getArmorDef(it.armorId) : null;
        const slotOf = def ? (def.slot === 'head' ? 'head' : def.slot === 'legs' ? 'legs' : 'chest') : null;
        if (!def || slotOf !== el.dataset.armor) { this.toast('That does not fit there'); this._dragCtx = null; return; }
        this.game.equipItemFromSlot(d.inv, d.index);
        this._dragCtx = null;
      });
      el.addEventListener('click', () => {
        if (this.game.player.armor[el.dataset.armor]) this.game.unequipArmorToBag(el.dataset.armor);
      });
    });
    // Weapon slots: drop to assign, click to select
    document.querySelectorAll('.eslot[data-wslot]').forEach(el => {
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('dragover');
        const d = this._dragCtx; if (!d) return;
        const s = d.inv.slots[d.index]; if (!s) return;
        const it = ITEMS[s.id];
        if (!it || it.type !== 'weapon' || !it.weaponId) { this.toast('Weapons only'); this._dragCtx = null; return; }
        const idx = +el.dataset.wslot;
        this.game.player.weaponSlots[idx] = it.weaponId;
        this.game.player.equipWeapon(it.weaponId);
        const w = getWeapon(it.weaponId);
        if (w.kind === 'ranged') this.game.player.mag = w.magSize;
        this.toast(`${it.name} → slot ${idx + 1}`);
        this.refreshInventory(); this.updateHUD();
        this._dragCtx = null;
      });
      el.addEventListener('click', () => {
        const wid = this.game.player.weaponSlots[+el.dataset.wslot];
        if (wid) { this.game.player.equipWeapon(wid); this.refreshInventory(); this.updateHUD(); }
      });
    });
    // Discard zone: drop to destroy
    const dz = document.getElementById('discardZone');
    if (dz) {
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dragover');
        const d = this._dragCtx; if (!d) return;
        const s = d.inv.slots[d.index]; if (!s) return;
        const name = ITEMS[s.id].name, qty = s.qty;
        d.inv.slots[d.index] = null;
        this.toast(`Discarded ${qty}x ${name}`);
        this.refreshInventory(); this.updateHUD();
        this._dragCtx = null;
      });
    }
  }

  refreshEquipment() {
    const p = this.game.player;
    const setA = (slot, itemEl, duraEl) => {
      const item = document.getElementById(itemEl), dura = document.getElementById(duraEl);
      if (!item) return;
      const inst = p.armor ? p.armor[slot] : null;
      const cell = item.parentElement;
      if (inst) {
        const iid = Player.itemIdForArmor(inst.id);
        const it = iid ? ITEMS[iid] : null;
        item.innerHTML = `<span class="glyph" style="color:${it ? it.color : '#999'}">${it ? it.glyph : '🛡'}</span>`;
        cell.classList.add('filled');
        cell.style.borderColor = it ? RARITY[it.rarity].color : '';
        cell.title = `${inst.def.name} — ${Math.round(inst.currentDurability)}/${inst.def.maxDurability} durability (click to unequip)`;
        if (dura) {
          const f = Utils.clamp(inst.currentDurability / inst.def.maxDurability, 0, 1);
          dura.style.display = 'block';
          dura.innerHTML = `<div style="width:${(f * 100).toFixed(0)}%;background:${f > 0.5 ? '#4fae5a' : f > 0.25 ? '#d9b74a' : '#d94f4f'}"></div>`;
        }
      } else {
        item.innerHTML = '';
        cell.classList.remove('filled'); cell.style.borderColor = ''; cell.title = '';
        if (dura) dura.style.display = 'none';
      }
    };
    setA('head', 'eqHead', 'duraHead');
    setA('chest', 'eqChest', 'duraChest');
    setA('legs', 'eqLegs', 'duraLegs');

    for (let i = 0; i < 3; i++) {
      const el = document.getElementById('eqW' + i);
      if (!el) continue;
      const wid = p.weaponSlots[i];
      const w = wid ? getWeapon(wid) : null;
      el.textContent = w ? w.name : '';
      el.parentElement.classList.toggle('filled', !!w);
      el.parentElement.classList.toggle('active', !!w && p.equipped === wid);
    }

    const ds = document.getElementById('dollStats');
    if (ds) {
      const dr = p.getTotalDamageReduction ? Math.round((p.getTotalDamageReduction() + (p.damageReduc || 0)) * 100) : 0;
      ds.innerHTML = `DMG RESIST <b>${dr}%</b><br>CARRY <b>${this.game.inventory.weight().toFixed(1)}/${p.carryWeight.toFixed(0)}kg</b>`;
    }

    // CHARACTER PREVIEW: the doll wears what you wear — every equipped piece
    // shows as a positioned icon; empty slots show nothing.
    const doll = document.getElementById('dollFigure');
    if (doll && typeof ARMOR_SLOTS !== 'undefined') {
      const slotPos = {
        head: 'top:-4px;left:50%;transform:translateX(-50%)',
        face: 'top:16px;left:50%;transform:translateX(-50%)',
        chest: 'top:38px;left:50%;transform:translateX(-50%)',
        back: 'top:38px;left:8%',
        arms: 'top:42px;right:4%',
        legs: 'top:64px;left:50%;transform:translateX(-50%)',
        feet: 'bottom:-2px;left:50%;transform:translateX(-50%)',
        accessory: 'top:16px;right:6%',
      };
      let html = '<span class="doll-base">🧍</span>';
      for (const slot of ARMOR_SLOTS) {
        const inst = p.armor[slot];
        if (!inst) continue;
        const rc = RARITY[inst.def.rarity] ? RARITY[inst.def.rarity].color : '#fff';
        html += `<span class="doll-item" style="${slotPos[slot] || ''};text-shadow:0 0 6px ${rc}" title="${inst.def.name}">${ARMOR_GLYPHS[slot] || '🛡'}</span>`;
      }
      const w = getWeapon(p.equipped);
      if (w) html += `<span class="doll-item doll-weapon" title="${w.name}">${w.kind === 'melee' ? '🔪' : '🔫'}</span>`;
      doll.innerHTML = html;
    }
  }

  // ---------- Admin / dev mode ----------
  _wireAdmin() {
    const wrap = document.getElementById('adminWeapons');
    if (wrap && typeof WEAPONS !== 'undefined') {
      for (const id of Object.keys(WEAPONS)) {
        const w = WEAPONS[id];
        const b = document.createElement('button');
        b.textContent = w.name + (w.kind === 'ranged' ? ' 🔫' : ' 🗡');
        b.addEventListener('click', () => this.game.adminGiveWeapon(id));
        wrap.appendChild(b);
      }
    }
    // Give-any-item list with live search
    const give = document.getElementById('adminGive');
    const search = document.getElementById('adminSearch');
    if (give && typeof ITEMS !== 'undefined') {
      const build = (filter) => {
        give.innerHTML = '';
        const f = (filter || '').toLowerCase();
        for (const id of Object.keys(ITEMS)) {
          const it = ITEMS[id];
          if (f && !(it.name.toLowerCase().includes(f) || it.type.includes(f))) continue;
          const b = document.createElement('button');
          b.innerHTML = `<span style="color:${it.color || '#ccc'}">${it.glyph || '▪'}</span> ${it.name}`;
          b.title = `${it.name} — ${it.type} (click: 1, shift-click: 10)`;
          b.addEventListener('click', (e) => this.game.adminGiveItem(id, e.shiftKey ? 10 : 1));
          give.appendChild(b);
        }
      };
      build('');
      if (search) search.addEventListener('input', () => build(search.value));
    }
    // Open/close from the HUD button + close X
    const openBtn = document.getElementById('adminBtn');
    if (openBtn) openBtn.addEventListener('click', () => this.game.toggleAdmin());
    const closeX = document.getElementById('adminClose');
    if (closeX) closeX.addEventListener('click', () => this.game.toggleAdmin());
    const god = document.getElementById('adminGod');
    const noclip = document.getElementById('adminNoclip');
    const ammo = document.getElementById('adminAmmo');
    if (god) god.addEventListener('change', () => { this.game.player.invincible = god.checked; if (god.checked) this.game.player.hp = this.game.player.maxHp; });
    if (noclip) noclip.addEventListener('change', () => { this.game.player.noclip = noclip.checked; });
    if (ammo) ammo.addEventListener('change', () => { this.game.player.infiniteAmmo = ammo.checked; if (ammo.checked) { const w = getWeapon(this.game.player.equipped); if (w && w.kind === 'ranged') this.game.player.mag = w.magSize; } });
    document.querySelectorAll('#adminPanel [data-admin]').forEach(btn =>
      btn.addEventListener('click', () => this.game.adminAction(btn.dataset.admin)));
  }
  setAdminOpen(open) {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !open);
    if (open) {
      const p = this.game.player;
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.checked = v; };
      set('adminGod', !!p.invincible); set('adminNoclip', !!p.noclip); set('adminAmmo', !!p.infiniteAmmo);
      this._buildAdminBosses();
      this._refreshAdminDash();
      clearInterval(this._adminDashTimer);
      this._adminDashTimer = setInterval(() => this._refreshAdminDash(), 1000);
    } else {
      clearInterval(this._adminDashTimer);
    }
  }

  _buildAdminBosses() {
    const wrap = document.getElementById('adminBosses');
    if (!wrap || wrap.childElementCount) return;
    for (const [id, e] of Object.entries(ENEMIES)) {
      if (!e.behavior || !e.behavior.boss) continue;
      const b = document.createElement('button');
      b.textContent = '☠ ' + e.name;
      b.addEventListener('click', () => this.game.adminAction('spawnBoss:' + id));
      wrap.appendChild(b);
    }
  }

  // Live dashboard: fps, entity counts, draw calls, memory, analytics digest.
  _refreshAdminDash() {
    const el = document.getElementById('adminDash');
    if (!el || el.closest('.hidden')) return;
    const g = this.game;
    const fps = g._fps || 0;
    const info = g.r3d && g.r3d.renderer ? g.r3d.renderer.info : null;
    const mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/a';
    const zAlive = g.entities.liveZombieCount();
    const bosses = g.entities.liveBossCount();
    const a = g.analytics ? g.analytics.counters : {};
    el.innerHTML =
      `<div>FPS: <b>${fps}</b> · Zombies: <b>${zAlive}</b> (${g.entities.zombies.length} incl. corpses) · Bosses: <b>${bosses}</b></div>` +
      `<div>Bullets: <b>${g.entities.bullets.length}</b> · Particles: <b>${g.entities.particles.length}</b> · Acid pools: <b>${g.entities.acidPools.length}</b></div>` +
      (info ? `<div>Draw calls: <b>${info.render.calls}</b> · Triangles: <b>${info.render.triangles}</b></div>` : '') +
      `<div>JS heap: <b>${mem}</b> · District: <b>D${g.currentDistrict}</b> · Weather: <b>${g.weather}</b></div>` +
      `<div>Kills ${a.kills || 0} · Mutants ${a.mutantKills || 0} · Bosses ${a.bossKills || 0} · Deaths ${a.deaths || 0}</div>` +
      `<div>Earned ${a.creditsEarned || 0}¢ · Missions ${a.missionsCompleted || 0} · Caches ${a.cachesFound || 0}</div>` +
      `<div>Weapon kills: ${Object.entries(g.analytics.byWeapon).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}</div>`;
  }

  _wireStaticButtons() {
    document.querySelectorAll('[data-close]').forEach(b =>
      b.addEventListener('click', () => this.game.setState('playing')));
  }

  // ---------- Toast ----------
  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- HUD ----------
  updateHUD() {
    const p = this.game.player;
    this._bar(this.el.health, p.hp, p.maxHp);
    this._bar(this.el.stamina, p.stamina, p.maxStamina);
    this._bar(this.el.xp, p.xp, p.xpForNext());
    this.el.healthText.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    this.el.staminaText.textContent = `${Math.ceil(p.stamina)}/${p.maxStamina}`;
    this.el.xpText.textContent = `XP ${p.xp}/${p.xpForNext()}`;
    this.el.level.textContent = `LVL ${p.level}`;
    this.el.currency.textContent = `⛁ ${p.currency}`;
    const wpn = getWeapon(p.equipped);
    let wtxt;
    if (wpn && wpn.kind === 'ranged') {
      const reserve = p.infiniteAmmo ? '∞' : this.game.inventory.count(wpn.ammoItem) + ' reserve';
      wtxt = `${wpn.name}  ${p.reloading ? 'RELOADING' : p.mag + '/' + wpn.magSize}  (${reserve})`;
    } else { wtxt = wpn ? wpn.name : 'Unarmed'; }
    this.el.weapon.textContent = wtxt;
    const wt = this.game.inventory.weight();
    this.el.weight.textContent = `${wt.toFixed(1)}/${p.carryWeight.toFixed(0)} kg`;
    this.el.weight.style.color = wt > p.carryWeight ? '#e05a5a' : '#9aa4ad';
    // active mission tracker — every accepted mission, live progress
    const mt = document.getElementById('missionTracker');
    if (mt) {
      const ms = this.game.missions;
      const list = ms ? ms.active : [];
      mt.classList.toggle('hidden', !list.length);
      if (list.length) {
        mt.innerHTML = list.map(m => {
          const t1 = m.objective.count || 1;
          let line = `<span class="mt-title">◈ ${m.title}</span> <span class="mt-prog">${Math.min(m.progress || 0, t1)}/${t1}</span>`;
          if (m.objective.and) {
            const t2 = m.objective.and.count || 1;
            line += ` <span class="mt-prog">+${Math.min(m.progress2 || 0, t2)}/${t2}</span>`;
          }
          return `<div class="mt-row">${line}</div>`;
        }).join('');
      }
    }
    // district chip
    const dc = document.getElementById('districtChip');
    if (dc && this.game.scene === this.game.overworld) {
      const d = this.game.currentDistrict || 1;
      const info = CONFIG.districts[d - 1];
      dc.textContent = `D${d} · ${info.name}`;
      dc.style.color = info.color;
      dc.style.display = '';
    } else if (dc) dc.style.display = 'none';
    this.el.kills.textContent = `Kills ${this.game.stats.kills}`;
    if (this.el.usernameHud) this.el.usernameHud.textContent = this.game.username || 'Survivor';
    this._updateStatusRow(p);
  }
  _bar(el, val, max) { el.style.width = `${Utils.clamp(val / max * 100, 0, 100)}%`; }

  // ---------- Injury / status effects ----------
  _updateStatusRow(p) {
    const row = document.getElementById('statusRow');
    if (!row) return;
    const chips = [];
    if (p.bleeding > 0) chips.push('<span class="status-chip bleed" title="Bleeding — bandage it!">🩸 BLEEDING</span>');
    if (p.fractured) chips.push('<span class="status-chip fracture" title="Broken bone — splint with a bandage">🦴 FRACTURE</span>');
    if (p.blur > 0) chips.push('<span class="status-chip blur" title="Bile in your eyes">🤢 BLINDED</span>');
    if (p.isInfected) chips.push(`<span class="status-chip infect" title="Infection ${Math.round(p.infectionLevel)}%">☣ ${Math.round(p.infectionLevel)}%</span>`);
    if (this.game.weather === 'rain' || this.game.weather === 'storm')
      chips.push(`<span class="status-chip weather">${this.game.weather === 'storm' ? '⛈' : '🌧'}</span>`);
    // BUFFS in green: active class ability, unique-weapon aura, set bonuses
    if (p.abilityActive) chips.push('<span class="status-chip buff">⚡ ABILITY</span>');
    const hw = getWeapon(p.equipped);
    if (hw && hw.buff) chips.push(`<span class="status-chip buff" title="Signature weapon buff">★ ${hw.name.split(' ')[0].toUpperCase()}</span>`);
    if (p.setBonuses && p.setBonuses.active && p.setBonuses.active.length)
      chips.push(`<span class="status-chip buff">🛡 SET ×${p.setBonuses.active.length}</span>`);
    row.innerHTML = chips.join('');
  }

  // ---------- Intro cutscene: the fall of Ravenside ----------
  playIntro(done) {
    const ov = document.getElementById('introOverlay');
    if (!ov) { done(); return; }
    const slides = [
      ['DAY 0', 'It started in the water treatment plant on the north side. Three workers went home sick.\nBy morning, none of them were people anymore.'],
      ['DAY 3', 'The army drew a line around the city and called it containment.\nThe line lasted seventy-one hours.'],
      ['DAY 6', 'The evacuation convoys never came back. The radios went quiet, district by district,\nuntil only the emergency loop remained.'],
      ['NOW', 'Ravenside Outpost still stands — scrap walls, tired guards, and survivors too stubborn to die.\nYou are one of them. The city is yours to take back. One street at a time.'],
    ];
    let i = 0;
    ov.classList.remove('hidden');
    const title = ov.querySelector('.intro-title');
    const text = ov.querySelector('.intro-text');
    const show = () => {
      if (i >= slides.length) { ov.classList.add('hidden'); clearTimeout(this._introT); done(); return; }
      title.textContent = slides[i][0];
      text.textContent = slides[i][1];
      ov.querySelector('.intro-inner').classList.remove('slide-in');
      void ov.querySelector('.intro-inner').offsetWidth;
      ov.querySelector('.intro-inner').classList.add('slide-in');
      i++;
      this._introT = setTimeout(show, 5200);
    };
    ov.querySelector('#introNext').onclick = () => { clearTimeout(this._introT); show(); };
    ov.querySelector('#introSkip').onclick = () => { i = slides.length; clearTimeout(this._introT); show(); };
    show();
  }

  // Full-screen injury FX: bile blur + bleeding tint, driven every frame.
  setInjuryFX(p) {
    const ov = document.getElementById('injuryOverlay');
    const gameCanvas = document.getElementById('game');
    if (ov) {
      ov.classList.toggle('bleeding', p.bleeding > 0);
      ov.classList.toggle('blinded', p.blur > 0);
    }
    if (gameCanvas) {
      // heavier blur right after the spit lands, easing off as it wears out
      const amt = p.blur > 0 ? Math.min(6, 1.5 + p.blur) : 0;
      const f = amt > 0 ? `blur(${amt.toFixed(1)}px) saturate(0.8)` : '';
      if (gameCanvas.style.filter !== f) gameCanvas.style.filter = f;
    }
  }

  // ---------- State changes ----------
  onStateChange(s) {
    this.el.inventoryWindow.classList.toggle('hidden', s !== 'inventory');
    this.el.traderWindow.classList.toggle('hidden', s !== 'trader');
    this.el.characterWindow.classList.toggle('hidden', s !== 'character');
    this.el.storageWindow.classList.toggle('hidden', s !== 'storage');
    const win = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); };
    win('missionWindow', s === 'missions');
    win('talentWindow', s === 'talents');
    win('marketWindow', s === 'market');
    win('armourWindow', s === 'armour');
    this.el.windows.classList.toggle('active', s !== 'playing' && s !== 'dead');
    if (s === 'inventory') this.refreshInventory();
    if (s === 'trader') this.refreshTrader();
    if (s === 'character') this.refreshCharacter();
    if (s === 'storage') this.refreshStorage();
    if (s === 'missions') this.refreshMissions();
    if (s === 'talents') this.refreshTalents();
    if (s === 'market') this.refreshMarket();
    if (s === 'armour') this.refreshArmour();
    this._hideTooltip();
  }

  // ---------- District banner ----------
  showDistrictBanner(d, info) {
    const el = document.getElementById('districtBanner');
    if (!el) return;
    el.innerHTML = `<div class="db-num" style="color:${info.color}">DISTRICT ${d}</div>` +
      `<div class="db-name">${info.name.toUpperCase()}</div>` +
      `<div class="db-danger">${'☠'.repeat(d)}</div>`;
    el.classList.remove('hidden');
    el.classList.remove('show');
    void el.offsetWidth;   // restart the CSS animation
    el.classList.add('show');
    clearTimeout(this._dbTimer);
    this._dbTimer = setTimeout(() => el.classList.add('hidden'), 3400);
  }

  // ---------- Missions (full board: active / offers / dailies) ----------
  _missionRewardLine(m) {
    const r = m.reward || {};
    const bits = [];
    if (r.credits) bits.push(`${r.credits}¢`);
    if (r.xp) bits.push(`${r.xp}xp`);
    for (const it of (r.items || [])) if (ITEMS[it.id]) bits.push(`${it.qty}x ${ITEMS[it.id].name}`);
    if (r.weaponRarity) bits.push(`${r.weaponRarity} weapon`);
    if (r.armorRarity) bits.push(`${r.armorRarity} armour`);
    return bits.join(' · ');
  }

  _missionProgressLine(m) {
    const t1 = m.objective.count || 1;
    let s = `${Math.min(m.progress || 0, t1)}/${t1}`;
    if (m.objective.and) s += ` — plus ${Math.min(m.progress2 || 0, m.objective.and.count || 1)}/${m.objective.and.count || 1}`;
    return s;
  }

  _missionCard(m, mode) {
    const ms = this.game.missions;
    const cat = MISSION_CATEGORIES[m.category] || MISSION_CATEGORIES.elimination;
    const card = document.createElement('div');
    card.className = 'mission-card' + (m.story ? ' story' : '');
    const stars = '★'.repeat(m.stars || 1) + '☆'.repeat(Math.max(0, 5 - (m.stars || 1)));
    let inner =
      `<div class="mc-head"><span class="mc-cat" style="color:${cat.color}">${cat.icon} ${cat.name}</span>` +
      `<span class="mc-stars" title="Difficulty">${stars}</span></div>` +
      `<div class="mc-title">${m.title}</div>` +
      `<div class="mc-desc">${m.desc}</div>` +
      `<div class="mc-reward">🎁 ${this._missionRewardLine(m)}</div>`;
    if (mode === 'active') {
      const t1 = m.objective.count || 1;
      const pct = Math.round(Math.min(1, (m.progress || 0) / t1) * 100);
      inner += `<div class="m-bar"><div style="width:${pct}%"></div></div>` +
        `<div class="mc-prog">${this._missionProgressLine(m)}</div>`;
    }
    card.innerHTML = inner;
    const btn = document.createElement('button');
    btn.className = 'buy-btn';
    if (mode === 'active') {
      btn.textContent = 'Abandon';
      btn.addEventListener('click', () => ms.abandon(m.id));
    } else {
      btn.textContent = 'Accept';
      btn.disabled = ms.active.length >= ms.maxActive;
      btn.addEventListener('click', () => ms.accept(m.id));
    }
    card.appendChild(btn);
    return card;
  }

  refreshMissions() {
    const ms = this.game.missions; if (!ms) return;
    const activeEl = document.getElementById('missionActive');
    const boardEl = document.getElementById('missionBoard');
    const dailyEl = document.getElementById('missionDailies');
    const countEl = document.getElementById('missionCount');
    if (countEl) countEl.textContent = `${ms.active.length}/${ms.maxActive} active · ${ms.completedCount} completed`;
    if (activeEl) {
      activeEl.innerHTML = '';
      if (!ms.active.length) activeEl.innerHTML = '<div class="mission-none">No active contracts — accept from the board below.</div>';
      for (const m of ms.active) activeEl.appendChild(this._missionCard(m, 'active'));
    }
    if (boardEl) {
      boardEl.innerHTML = '';
      for (const m of ms.board) boardEl.appendChild(this._missionCard(m, 'board'));
    }
    if (dailyEl) {
      dailyEl.innerHTML = '';
      if (!ms.dailies.length) dailyEl.innerHTML = '<div class="mission-none">Dailies done — new contracts tomorrow.</div>';
      for (const m of ms.dailies) dailyEl.appendChild(this._missionCard(m, 'board'));
    }
  }

  refreshAll() { this.updateHUD(); this.refreshInventory(); }

  // ---------- Inventory ----------
  refreshInventory() {
    const grid = document.getElementById('invGrid');
    if (!grid) return;
    this._buildGrid(grid, this.game.inventory, 'inventory');
    const p = this.game.player;
    document.getElementById('invWeight').textContent =
      `Weight: ${this.game.inventory.weight().toFixed(1)} / ${p.carryWeight.toFixed(0)} kg`;
    this.refreshEquipment();
  }

  _buildGrid(gridEl, inv, context) {
    gridEl.style.gridTemplateColumns = `repeat(${inv.cols}, 1fr)`;
    gridEl.innerHTML = '';
    for (let i = 0; i < inv.slots.length; i++) {
      const slot = inv.slots[i];
      const cell = document.createElement('div');
      cell.className = 'slot';
      cell.dataset.index = i;
      cell.dataset.context = context;

      if (slot) {
        const item = ITEMS[slot.id];
        const isProceduralWeapon = slot.data && slot.data.affixes;
        const rarity = isProceduralWeapon ? slot.data.rarity : item.rarity;
        cell.classList.add('filled');
        cell.style.borderColor = RARITY[rarity].color;
        cell.innerHTML =
          `<span class="glyph" style="color:${item.color}">${item.glyph || '▪'}</span>` +
          (slot.qty > 1 ? `<span class="qty">${slot.qty}</span>` : '') +
          (item.type === 'weapon' ? `<span class="tag">${isProceduralWeapon ? slot.data.affixes.length : 'W'}</span>` : '');
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => this._onDragStart(e, inv, i, context));
        cell.addEventListener('mouseenter', (e) => this._showTooltip(e, slot));
        cell.addEventListener('mousemove', (e) => this._moveTooltip(e));
        cell.addEventListener('mouseleave', () => this._hideTooltip());
        cell.addEventListener('click', () => this._onSlotClick(inv, i, context));
      }
      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('dragover'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('dragover'));
      cell.addEventListener('drop', (e) => this._onDrop(e, inv, i, context));
      gridEl.appendChild(cell);
    }
  }

  _onDragStart(e, inv, index, context) {
    this._dragCtx = { inv, index, context };
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  }

  _onDrop(e, destInv, destIndex, destContext) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const d = this._dragCtx;
    if (!d) return;
    if (d.inv === destInv) {
      destInv.moveSlot(d.index, destIndex);
    } else {
      // transfer between inventory and storage
      this._transfer(d.inv, d.index, destInv);
    }
    this._dragCtx = null;
    this.refreshInventory();
    this.refreshStorage();
    this.updateHUD();
  }

  _transfer(srcInv, srcIndex, destInv) {
    const s = srcInv.slots[srcIndex];
    if (!s) return;
    const leftover = destInv.add(s.id, s.qty);
    const moved = s.qty - leftover;
    srcInv.removeSlot(srcIndex, moved);
    if (leftover > 0) this.toast('Not enough space to transfer all');
  }

  _onSlotClick(inv, index, context) {
    const slot = inv.slots[index];
    if (!slot) return;
    if (context === 'trader-sell') { this._sell(index); return; }
    if (context === 'market-sell') {
      const r = this.game.market.listFromSlot(index);
      this.toast(r.msg);
      this.refreshMarket(); this.updateHUD();
      return;
    }
    if (context === 'storage-player' || context === 'storage-stash') {
      // click transfers one stack to the other container
      const other = context === 'storage-player' ? this.game.storage : this.game.inventory;
      this._transfer(inv, index, other);
      this.refreshStorage(); this.updateHUD();
      return;
    }
    // main inventory: use or equip
    const item = ITEMS[slot.id];
    if (item.type === 'consumable') this.game.useItem(slot.id);
    else if (item.type === 'weapon' || item.type === 'armor') this.game.equipItemFromSlot(inv, index);
    else this.toast(`${item.name} — ${item.type}`);
    this.refreshInventory();
  }

  // ---------- Trader ----------
  refreshTrader() {
    const buyList = document.getElementById('traderBuyList');
    const sellGrid = document.getElementById('traderSellGrid');
    document.getElementById('traderCredits').textContent = `⛁ ${this.game.player.currency}`;
    // Buy list
    buyList.innerHTML = '';
    for (const entry of this.game.trader.stock) {
      const item = ITEMS[entry.id];
      const row = document.createElement('div');
      row.className = 'trade-row';
      const stockLabel = entry.qty < 0 ? '∞' : entry.qty;
      row.innerHTML =
        `<span class="ti" style="color:${item.color}">${item.glyph || '▪'}</span>` +
        `<span class="tn" style="color:${RARITY[item.rarity].color}">${item.name}</span>` +
        `<span class="ts">x${stockLabel}</span>` +
        `<span class="tp">⛁ ${buyPrice(entry.id)}</span>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = 'Buy';
      btn.disabled = entry.qty === 0;
      btn.addEventListener('click', () => {
        const r = this.game.trader.buy(this.game, entry.id);
        this.toast(r.msg);
        this.refreshTrader(); this.updateHUD();
      });
      row.appendChild(btn);
      row.addEventListener('mouseenter', (e) => this._showTooltip(e, { id: entry.id, qty: 1 }, true));
      row.addEventListener('mousemove', (e) => this._moveTooltip(e));
      row.addEventListener('mouseleave', () => this._hideTooltip());
      buyList.appendChild(row);
    }
    // Sell grid = player inventory
    this._buildGrid(sellGrid, this.game.inventory, 'trader-sell');
  }

  _sell(index) {
    const r = this.game.trader.sell(this.game, index);
    this.toast(r.msg);
    this.refreshTrader(); this.updateHUD();
  }

  // ---------- Character ----------
  refreshCharacter() {
    const p = this.game.player;
    document.getElementById('charLevel').textContent = p.level;
    document.getElementById('charXP').textContent = `${p.xp} / ${p.xpForNext()}`;
    document.getElementById('charPoints').textContent = p.statPoints;
    document.getElementById('charKills').textContent = this.game.stats.kills;
    document.getElementById('charHeadshots').textContent = this.game.stats.headshots;
    document.getElementById('charLooted').textContent = this.game.stats.looted;
    document.getElementById('charTime').textContent = this._fmtTime(this.game.stats.playtime);

    const derived = document.getElementById('charDerived');
    derived.innerHTML =
      `<div>Max Health: <b>${p.maxHp}</b></div>` +
      `<div>Max Stamina: <b>${p.maxStamina}</b></div>` +
      `<div>Carry Weight: <b>${p.carryWeight.toFixed(0)} kg</b></div>` +
      `<div>Melee Damage: <b>+${Math.round((p.meleeMult - 1) * 100)}%</b></div>` +
      `<div>Move Speed: <b>${Math.round(p.speedMult * 100)}%</b></div>` +
      `<div>Rate of Fire: <b>${Math.round(p.fireRateMult * 100)}%</b></div>` +
      `<div>Reload Speed: <b>${Math.round((p.reloadMult || 1) * 100)}%</b></div>` +
      `<div>Sprint Drain: <b>${Math.round((p.staminaDrainMult || 1) * 100)}%</b></div>` +
      `<div>Aim Steadiness: <b>+${Math.round(p.spreadReduce * 1000) / 10}</b></div>` +
      `<div>Loot Fortune: <b>+${Math.round(p.lootBonus * 100)}%</b></div>`;

    const list = document.getElementById('statList');
    list.innerHTML = '';
    const info = {
      strength: 'Carry weight & melee damage',
      endurance: 'Health, stamina & slower sprint drain',
      accuracy: 'Reduced weapon spread',
      survival: 'Slower hunger/thirst & better loot',
      dexterity: 'Faster rate of fire',
      agility: 'Faster movement',
      reloading: 'Faster reloads',
    };
    for (const key of Object.keys(p.stats)) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML =
        `<span class="sk">${key[0].toUpperCase() + key.slice(1)}</span>` +
        `<span class="sv">${p.stats[key]}</span>` +
        `<span class="sd">${info[key] || ''}</span>`;
      const btn = document.createElement('button');
      btn.className = 'stat-btn';
      btn.textContent = '+';
      btn.disabled = p.statPoints <= 0;
      btn.addEventListener('click', () => {
        if (this.game.player.spendStat(key)) {
          this.toast(`${key} increased to ${this.game.player.stats[key]}`);
          this.refreshCharacter(); this.updateHUD();
          SaveSystem.save(this.game);
        }
      });
      row.appendChild(btn);
      list.appendChild(row);
    }

    this._refreshAchievements();
  }

  // ---------- Achievements + lifetime record (character sheet) ----------
  _refreshAchievements() {
    const wrap = document.getElementById('achievementList');
    if (!wrap || typeof ACHIEVEMENTS === 'undefined') return;
    const unlocked = this.game.achievements ? this.game.achievements.unlocked : [];
    wrap.innerHTML = '';
    for (const [id, a] of Object.entries(ACHIEVEMENTS)) {
      const has = unlocked.includes(id);
      const el = document.createElement('div');
      el.className = 'ach' + (has ? ' owned' : '');
      el.title = a.desc;
      el.innerHTML = `<span class="ach-icon">${a.icon}</span><span class="ach-name">${a.name}</span>`;
      wrap.appendChild(el);
    }
    const rec = document.getElementById('lifetimeStats');
    if (rec && this.game.analytics) {
      const c = this.game.analytics.counters;
      rec.innerHTML =
        `<div>Mutants killed: <b>${c.mutantKills}</b></div>` +
        `<div>Bosses killed: <b>${c.bossKills}</b></div>` +
        `<div>Missions done: <b>${c.missionsCompleted}</b></div>` +
        `<div>Credits earned: <b>${c.creditsEarned}¢</b></div>` +
        `<div>Deaths: <b>${c.deaths}</b></div>` +
        `<div>Deepest district: <b>D${this.game.analytics.maxDistrict}</b></div>`;
    }
  }

  // ---------- TALENT WINDOW: visual tree, nodes + connectors ----------
  refreshTalents() {
    const wrap = document.getElementById('talentGrid');
    if (!wrap || typeof SKILL_TREE === 'undefined') return;
    const p = this.game.player;
    const ptsEl = document.getElementById('talentPoints');
    if (ptsEl) ptsEl.textContent = p.skillPoints || 0;
    wrap.innerHTML = '';
    for (const [catId, cat] of Object.entries(TALENT_CATEGORIES)) {
      const col = document.createElement('div');
      col.className = 'talent-col';
      col.innerHTML =
        `<div class="talent-cat" style="border-color:${cat.color}">` +
        `<span class="tc-icon">${cat.icon}</span><span class="tc-name">${cat.name}</span></div>`;
      for (let rank = 1; rank <= 3; rank++) {
        const id = `${catId}_${rank}`;
        const s = SKILL_TREE[id];
        if (!s) continue;
        const owned = p.unlockedSkills.includes(id);
        const check = canUnlockSkill(p, id);
        // connector segment above every node except the first
        if (rank > 1) {
          const conn = document.createElement('div');
          conn.className = 'talent-conn' + (p.unlockedSkills.includes(`${catId}_${rank - 1}`) ? ' lit' : '');
          conn.style.background = p.unlockedSkills.includes(`${catId}_${rank - 1}`) ? cat.color : '';
          col.appendChild(conn);
        }
        const node = document.createElement('div');
        node.className = 'talent-node' + (owned ? ' owned' : check.ok ? ' available' : ' locked');
        if (owned) node.style.borderColor = cat.color;
        node.innerHTML =
          `<div class="tn-rank">${'●'.repeat(rank)}${'○'.repeat(3 - rank)}</div>` +
          `<div class="tn-name">${s.name}</div>` +
          `<div class="tn-cost">${owned ? '✓ LEARNED' : s.cost + ' pt'}</div>`;
        node.addEventListener('mouseenter', (e) => this._talentTooltip(e, s, owned, check));
        node.addEventListener('mousemove', (e) => this._moveTooltip(e));
        node.addEventListener('mouseleave', () => this._hideTooltip());
        if (!owned && check.ok) {
          node.addEventListener('click', () => {
            if (this.game.unlockSkill(id)) {
              node.classList.add('just-unlocked');
              this.refreshTalents();
            }
          });
        }
        col.appendChild(node);
      }
      wrap.appendChild(col);
    }
  }

  _talentTooltip(e, s, owned, check) {
    const cat = TALENT_CATEGORIES[s.category];
    const t = this.el.tooltip;
    t.innerHTML =
      `<div class="tt-name" style="color:${cat.color}">${cat.icon} ${s.name}</div>` +
      `<div class="tt-type">${cat.desc}</div>` +
      `<div class="tt-use">${s.desc}</div>` +
      `<div class="tt-meta">${owned ? 'Learned' : check.ok ? `Click to learn — ${s.cost} talent point${s.cost > 1 ? 's' : ''}` : (check.why || 'Locked')}</div>`;
    t.classList.add('show');
    this._moveTooltip(e);
  }

  // ---------- MARKETPLACE WINDOW ----------
  _wireMarket() {
    const search = document.getElementById('marketSearch');
    if (search) search.addEventListener('input', () => this.refreshMarket());
    const sort = document.getElementById('marketSort');
    if (sort) sort.addEventListener('change', () => this.refreshMarket());
    const tabs = document.getElementById('marketCats');
    if (tabs && typeof MARKET_CATEGORY_LIST !== 'undefined') {
      tabs.innerHTML = '';
      for (const c of MARKET_CATEGORY_LIST) {
        const b = document.createElement('button');
        b.className = 'mkt-cat';
        b.dataset.cat = c.id;
        b.innerHTML = `${c.icon} ${c.name}`;
        b.addEventListener('click', () => { this._marketCat = c.id; this.refreshMarket(); });
        tabs.appendChild(b);
      }
    }
    document.querySelectorAll('#marketWindow [data-mtab]').forEach(b =>
      b.addEventListener('click', () => { this._marketTab = b.dataset.mtab; this.refreshMarket(); }));
    this._marketCat = 'all';
    this._marketTab = 'buy';
  }

  refreshMarket() {
    const mk = this.game.market; if (!mk) return;
    const credEl = document.getElementById('marketCredits');
    if (credEl) credEl.textContent = `⛁ ${this.game.player.currency}`;
    document.querySelectorAll('#marketCats .mkt-cat').forEach(b =>
      b.classList.toggle('active', b.dataset.cat === this._marketCat));
    document.querySelectorAll('#marketWindow [data-mtab]').forEach(b =>
      b.classList.toggle('active', b.dataset.mtab === this._marketTab));
    const buyPane = document.getElementById('marketBuyPane');
    const sellPane = document.getElementById('marketSellPane');
    if (buyPane) buyPane.classList.toggle('hidden', this._marketTab !== 'buy');
    if (sellPane) sellPane.classList.toggle('hidden', this._marketTab !== 'sell');
    if (this._marketTab === 'buy') this._refreshMarketBuy();
    else this._refreshMarketSell();
  }

  _refreshMarketBuy() {
    const mk = this.game.market;
    const listEl = document.getElementById('marketList');
    if (!listEl) return;
    const q = (document.getElementById('marketSearch')?.value || '').toLowerCase();
    const sort = document.getElementById('marketSort')?.value || 'price';
    let rows = mk.listings.filter(l => {
      const it = ITEMS[l.itemId];
      if (!it) return false;
      if (this._marketCat !== 'all' && marketCategoryOf(it) !== this._marketCat) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const rarityRank = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    rows.sort((a, b) => {
      const ia = ITEMS[a.itemId], ib = ITEMS[b.itemId];
      switch (sort) {
        case 'price': return a.price - b.price;
        case 'priceDesc': return b.price - a.price;
        case 'rarity': return (rarityRank[ib.rarity] || 0) - (rarityRank[ia.rarity] || 0);
        case 'damage': {
          const da = ia.weaponId ? (WEAPONS[ia.weaponId] || {}).damage || 0 : 0;
          const db = ib.weaponId ? (WEAPONS[ib.weaponId] || {}).damage || 0 : 0;
          return db - da;
        }
        case 'newest': return b.listedAt - a.listedAt;
        default: return ia.name.localeCompare(ib.name);
      }
    });
    listEl.innerHTML = '';
    if (!rows.length) listEl.innerHTML = '<div class="mission-none">No listings match — the market shifts constantly, check back.</div>';
    for (const l of rows) {
      const it = ITEMS[l.itemId];
      const trend = mk.trendOf(l.itemId);
      const row = document.createElement('div');
      row.className = 'mkt-row';
      row.innerHTML =
        `<span class="ti" style="color:${it.color}">${it.glyph || '▪'}</span>` +
        `<span class="tn" style="color:${RARITY[it.rarity].color}">${it.name}${l.qty > 1 ? ` ×${l.qty}` : ''}</span>` +
        `<span class="mkt-seller">${l.seller}</span>` +
        `<span class="mkt-trend ${trend}">${trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}</span>` +
        `<span class="tp">⛁ ${l.price}</span>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = 'Buy';
      btn.disabled = this.game.player.currency < l.price;
      btn.addEventListener('click', () => {
        const r = mk.buy(l.id);
        this.toast(r.msg);
        this.refreshMarket(); this.updateHUD();
      });
      row.appendChild(btn);
      row.addEventListener('mouseenter', (e) => this._showTooltip(e, { id: l.itemId, qty: l.qty }, true));
      row.addEventListener('mousemove', (e) => this._moveTooltip(e));
      row.addEventListener('mouseleave', () => this._hideTooltip());
      listEl.appendChild(row);
    }
  }

  _refreshMarketSell() {
    const mk = this.game.market;
    const grid = document.getElementById('marketSellGrid');
    if (grid) this._buildGrid(grid, this.game.inventory, 'market-sell');
    const mine = document.getElementById('marketMyListings');
    if (mine) {
      mine.innerHTML = '';
      if (!mk.playerListings.length) mine.innerHTML = '<div class="mission-none">No listings. Click an item on the left to post it.</div>';
      for (const l of mk.playerListings) {
        const it = ITEMS[l.itemId];
        const row = document.createElement('div');
        row.className = 'mkt-row';
        row.innerHTML =
          `<span class="ti" style="color:${it.color}">${it.glyph || '▪'}</span>` +
          `<span class="tn">${it.name}${l.qty > 1 ? ` ×${l.qty}` : ''}</span>` +
          `<span class="tp">asks ⛁ ${l.price}</span>`;
        const btn = document.createElement('button');
        btn.className = 'buy-btn';
        btn.textContent = 'Cancel';
        btn.addEventListener('click', () => { mk.cancelListing(l.id); this.refreshMarket(); this.updateHUD(); });
        row.appendChild(btn);
        mine.appendChild(row);
      }
    }
  }

  // ---------- ARMOUR WINDOW: 8 slots, sets, stats ----------
  refreshArmour() {
    const p = this.game.player;
    const slotWrap = document.getElementById('armourSlots');
    if (slotWrap && typeof ARMOR_SLOTS !== 'undefined') {
      slotWrap.innerHTML = '';
      for (const slot of ARMOR_SLOTS) {
        const inst = p.armor[slot];
        const cell = document.createElement('div');
        cell.className = 'arm-slot' + (inst ? ' filled' : '');
        const label = ARMOR_SLOT_LABELS[slot] || slot;
        if (inst) {
          const setInfo = inst.def.set && ARMOR_SETS[inst.def.set];
          const durF = inst.currentDurability / inst.def.maxDurability;
          cell.style.borderColor = RARITY[inst.def.rarity].color;
          cell.innerHTML =
            `<div class="as-label">${label}</div>` +
            `<div class="as-glyph">${ARMOR_GLYPHS[slot] || '🛡'}</div>` +
            `<div class="as-name" style="color:${RARITY[inst.def.rarity].color}">${inst.def.name}</div>` +
            (setInfo ? `<div class="as-set" style="color:${setInfo.color}">${setInfo.name}</div>` : '') +
            `<div class="dura" style="display:block"><div style="width:${(durF * 100).toFixed(0)}%;background:${durF > 0.5 ? '#4fae5a' : durF > 0.25 ? '#d9b74a' : '#d94f4f'}"></div></div>`;
          cell.title = 'Click to unequip';
          cell.addEventListener('click', () => { this.game.unequipArmorToBag(slot); this.refreshArmour(); });
          cell.addEventListener('mouseenter', (e) => {
            const iid = Player.itemIdForArmor(inst.id);
            if (iid) this._showTooltip(e, { id: iid, qty: 1 });
          });
          cell.addEventListener('mousemove', (e) => this._moveTooltip(e));
          cell.addEventListener('mouseleave', () => this._hideTooltip());
        } else {
          cell.innerHTML = `<div class="as-label">${label}</div><div class="as-glyph empty">＋</div><div class="as-name dim">empty</div>`;
        }
        slotWrap.appendChild(cell);
      }
    }
    // stats panel
    const stats = document.getElementById('armourStats');
    if (stats) {
      const dr = Math.round((p.getTotalDamageReduction() + (p.damageReduc || 0)) * 100);
      const wt = p.weight ? p.weight.armor.toFixed(1) : '0';
      stats.innerHTML =
        `<div>Armour Rating: <b>${p.getArmorRating()}</b></div>` +
        `<div>Damage Reduction: <b>${dr}%</b></div>` +
        `<div>Armour Weight: <b>${wt} kg</b></div>` +
        `<div>Move Speed: <b>${Math.round(p.speedMult * 100)}%</b></div>` +
        `<div>Bile Resist: <b>${Math.round((1 - (p.blurResist || 1)) * 100)}%</b></div>` +
        `<div>Rad Resist: <b>${Math.round((1 - (p.radResist || 1)) * 100)}%</b></div>`;
    }
    // set bonuses
    const sets = document.getElementById('armourSets');
    if (sets) {
      const sb = p.setBonuses || { active: [], counts: {} };
      sets.innerHTML = '<h3>Set Bonuses</h3>';
      const seen = Object.keys(sb.counts);
      if (!seen.length) sets.innerHTML += '<div class="mission-none">No set pieces equipped. Matching gear unlocks bonuses at 2 / 4 / 6 pieces.</div>';
      for (const setId of seen) {
        const set = ARMOR_SETS[setId];
        if (!set) continue;
        const n = sb.counts[setId];
        let html = `<div class="set-block"><div class="set-name" style="color:${set.color}">${set.name} (${n} pc)</div>`;
        for (const [need, bonus] of Object.entries(set.bonuses)) {
          const on = n >= +need;
          html += `<div class="set-tier ${on ? 'on' : ''}">${need}pc: ${this._describeBonus(bonus)}</div>`;
        }
        sets.innerHTML += html + '</div>';
      }
    }
    // equippable armour from the bag
    const bag = document.getElementById('armourBag');
    if (bag) {
      bag.innerHTML = '';
      const inv = this.game.inventory;
      let found = 0;
      for (let i = 0; i < inv.slots.length; i++) {
        const s = inv.slots[i];
        if (!s) continue;
        const it = ITEMS[s.id];
        if (!it || it.type !== 'armor') continue;
        found++;
        const def = getArmorDef(it.armorId);
        const row = document.createElement('div');
        row.className = 'mkt-row';
        row.innerHTML =
          `<span class="ti" style="color:${it.color}">${it.glyph}</span>` +
          `<span class="tn" style="color:${RARITY[it.rarity].color}">${it.name}</span>` +
          `<span class="mkt-seller">${ARMOR_SLOT_LABELS[def.slot] || def.slot}</span>` +
          `<span class="tp">DR ${Math.round(def.damageReduction * 100)}%</span>`;
        const btn = document.createElement('button');
        btn.className = 'buy-btn';
        btn.textContent = 'Equip';
        btn.addEventListener('click', () => {
          this.game.equipItemFromSlot(inv, i);
          this.refreshArmour();
        });
        row.appendChild(btn);
        row.addEventListener('mouseenter', (e) => this._showTooltip(e, s));
        row.addEventListener('mousemove', (e) => this._moveTooltip(e));
        row.addEventListener('mouseleave', () => this._hideTooltip());
        bag.appendChild(row);
      }
      if (!found) bag.innerHTML = '<div class="mission-none">No armour in your bag. Hunt lockers, bosses and the marketplace.</div>';
    }
  }

  _describeBonus(bonus) {
    const names = {
      damageReduc: v => `+${Math.round(v * 100)}% defence`,
      lootBonus: v => `+${Math.round(v * 100)}% loot fortune`,
      speedBonus: v => `+${Math.round(v * 100)}% move speed`,
      healMult: v => `+${Math.round((v - 1) * 100)}% healing`,
      fractureResist: v => `fractures ${Math.round(v * 100)}% less likely`,
      bleedResist: v => `bleeding ${Math.round(v * 100)}% less likely`,
      radResist: v => `+${Math.round(v * 100)}% rad resist`,
      blurResist: v => `+${Math.round(v * 100)}% bile resist`,
    };
    return Object.entries(bonus).map(([k, v]) => (names[k] ? names[k](v) : `${k} ${v}`)).join(', ');
  }

  // ---------- Storage ----------
  refreshStorage() {
    const pg = document.getElementById('storagePlayerGrid');
    const sg = document.getElementById('storageStashGrid');
    if (!pg || !sg) return;
    this._buildGrid(pg, this.game.inventory, 'storage-player');
    this._buildGrid(sg, this.game.storage, 'storage-stash');
    document.getElementById('storageHint').textContent =
      'Click an item to move it across • drag to reorder';
  }

  // ---------- Death ----------
  showDeath() {
    this.el.deathScreen.classList.remove('hidden');
    document.getElementById('deathStats').innerHTML =
      `Level ${this.game.player.level} • ${this.game.stats.kills} kills • ${this.game.stats.looted} containers looted`;
  }
  hideDeath() { this.el.deathScreen.classList.add('hidden'); }

  // ---------- Loading instance ----------
  showLoading(action, name) {
    const ls = document.getElementById('loadingScreen');
    if (!ls) return;
    document.getElementById('loadingAction').textContent = action || 'LOADING';
    document.getElementById('loadingName').textContent = name || '';
    // rotating tip or lore line, DF1 loading-screen style
    const tipEl = document.getElementById('loadingTip');
    if (tipEl && typeof DZ_TIPS !== 'undefined') {
      const pool = Math.random() < 0.6 ? DZ_TIPS : DZ_LORE;
      tipEl.textContent = pool[Math.floor(Math.random() * pool.length)];
    }
    const bar = document.getElementById('loadingBarFill');
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    ls.classList.remove('hidden');
  }
  hideLoading() {
    const ls = document.getElementById('loadingScreen');
    if (ls) ls.classList.add('hidden');
  }

  // ---------- Loot channel bar ----------
  showLootBar() {
    const el = document.getElementById('lootBar');
    if (el) { el.classList.remove('hidden'); const f = document.getElementById('lootFill'); if (f) f.style.width = '0%'; }
  }
  updateLootBar(frac) {
    const f = document.getElementById('lootFill');
    if (f) f.style.width = (Utils.clamp(frac, 0, 1) * 100) + '%';
  }
  hideLootBar() {
    const el = document.getElementById('lootBar');
    if (el) el.classList.add('hidden');
  }

  // ---------- Tactical pause: countdown ----------
  showCountdown(n) {
    const el = document.getElementById('pauseCountdown');
    if (!el) return;
    const num = document.getElementById('pcNum');
    if (num) num.textContent = n;
    el.classList.remove('hidden');
  }
  updateCountdown(n) {
    const num = document.getElementById('pcNum');
    if (num) num.textContent = n;
  }
  hideCountdown() {
    const el = document.getElementById('pauseCountdown');
    if (el) el.classList.add('hidden');
  }

  // ---------- Tactical pause: menu ----------
  showPauseMenu() {
    document.getElementById('pauseMenu').classList.remove('hidden');
    document.getElementById('settingsPanel').classList.add('hidden');
    this.hideWorldMap();
  }
  hidePauseMenu() {
    const pm = document.getElementById('pauseMenu');
    if (pm) pm.classList.add('hidden');
  }
  showWorldMap() {
    document.getElementById('worldMap').classList.remove('hidden');
    if (this.game.minimap) this.game.minimap.renderWorldMap(this.game);
  }
  hideWorldMap() {
    const wm = document.getElementById('worldMap');
    if (wm) wm.classList.add('hidden');
  }

  _wirePause() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('pauseResume', () => this.game.resumeGame());
    on('pauseInv', () => this.game.openFromPause('inventory'));
    on('pauseMap', () => this.showWorldMap());
    on('worldMapClose', () => this.hideWorldMap());
    on('pauseSettings', () => {
      const sp = document.getElementById('settingsPanel');
      if (sp) sp.classList.toggle('hidden');
    });
    this._initSettingsControls();
  }

  // Populate graphics-settings controls from saved Settings and wire live changes.
  _initSettingsControls() {
    Settings.load();
    const d = Settings.data;
    const bind = (id, evt, get, mutate) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(evt, () => { mutate(get(el)); Settings.save(); Settings.apply(this.game); });
    };
    const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

    const rd = document.getElementById('setRenderDist');
    if (rd) { rd.value = d.renderDistance; setText('setRenderDistVal', d.renderDistance); }
    bind('setRenderDist', 'input', el => +el.value, v => { d.renderDistance = v; setText('setRenderDistVal', v); });

    const sh = document.getElementById('setShadow');
    if (sh) sh.value = d.shadowQuality;
    bind('setShadow', 'change', el => el.value, v => { d.shadowQuality = v; });

    const aa = document.getElementById('setAA');
    if (aa) aa.checked = !!d.antialias;
    bind('setAA', 'change', el => el.checked, v => { d.antialias = v; });

    const rs = document.getElementById('setResScale');
    if (rs) { rs.value = d.resolutionScale; setText('setResScaleVal', d.resolutionScale + '×'); }
    bind('setResScale', 'input', el => +el.value, v => { d.resolutionScale = v; setText('setResScaleVal', v + '×'); });

    const fps = document.getElementById('setFps');
    if (fps) fps.value = String(d.fpsLimit);
    bind('setFps', 'change', el => +el.value, v => { d.fpsLimit = v; });
  }

  // ---------- Tooltip ----------
  _wireTooltip() { /* tooltip element pre-exists in DOM */ }
  _showTooltip(e, slot, isBuy) {
    const item = ITEMS[slot.id];
    if (!item) return;
    const t = this.el.tooltip;
    const priceLine = isBuy ? `Buy: ⛁ ${buyPrice(item.id)}` : `Sell: ⛁ ${sellPrice(item.id)}`;
    const uses = [];
    if (item.use) { if (item.use.health) uses.push(`+${item.use.health} HP`); if (item.use.stamina) uses.push(`+${item.use.stamina} Stamina`); }

    let html = `<div class="tt-name" style="color:${RARITY[item.rarity].color}">${item.name}</div>` +
      `<div class="tt-type">${RARITY[item.rarity].name} • ${item.type}</div>`;

    if (slot.data && slot.data.affixes) {
      const rarity = slot.data.rarity || 'common';
      html = `<div class="tt-name" style="color:${RARITY[rarity].color}">${slot.data.name}</div>` +
        `<div class="tt-type">${RARITY[rarity].name} • Weapon</div>`;
      if (slot.data.affixes.length > 0) {
        html += `<div class="tt-affixes">`;
        for (const aff of slot.data.affixes) {
          const affixInfo = getAffixInfo(aff);
          if (affixInfo) html += `<div style="color:${affixInfo.color}">✦ ${affixInfo.name}</div>`;
        }
        html += `</div>`;
      }
    } else {
      if (uses.length) html += `<div class="tt-use">${uses.join(', ')}</div>`;
      // Full weapon sheet: damage / fire rate / accuracy / range / mag
      if (item.weaponId && getWeapon(item.weaponId)) {
        const w = getWeapon(item.weaponId);
        html += `<div class="tt-stats">`;
        html += `<div>Damage <b>${w.damage}${w.pellets ? ' ×' + w.pellets : ''}</b></div>`;
        html += `<div>Fire rate <b>${(1 / w.fireRate).toFixed(1)}/s</b></div>`;
        if (w.kind === 'ranged') {
          html += `<div>Accuracy <b>${Math.max(0, Math.round(100 - w.spread * 500))}%</b></div>`;
          html += `<div>Range <b>${Math.round(w.range / 100)}m</b></div>`;
          html += `<div>Mag <b>${w.magSize}</b> · Reload <b>${w.reloadTime}s</b></div>`;
          html += `<div>Ammo <b>${w.ammoType}</b></div>`;
        } else {
          html += `<div>Reach <b>${w.range}</b> · Arc <b>${Math.round(w.arc * 57)}°</b></div>`;
        }
        if (w.unique) html += `<div style="color:#ffd700">★ Signature weapon</div>`;
        html += `</div>`;
      }
      // Full armour sheet: rating / weight / bonuses / set
      if (item.armorId && getArmorDef(item.armorId)) {
        const a = getArmorDef(item.armorId);
        html += `<div class="tt-stats">`;
        html += `<div>Slot <b>${ARMOR_SLOT_LABELS[a.slot] || a.slot}</b></div>`;
        html += `<div>Armour rating <b>${Math.round(a.damageReduction * 100)}</b></div>`;
        html += `<div>Durability <b>${a.maxDurability}</b></div>`;
        const bonuses = [];
        if (a.speedBonus) bonuses.push(`+${Math.round(a.speedBonus * 100)}% speed`);
        if (a.carryBonus) bonuses.push(`+${a.carryBonus}kg carry`);
        if (a.stealthBonus || a.stealth) bonuses.push('stealth');
        if (a.detectBonus) bonuses.push(`+${Math.round(a.detectBonus * 100)}% awareness`);
        if (a.blurResist) bonuses.push(`${Math.round(a.blurResist * 100)}% bile resist`);
        if (a.radResist) bonuses.push(`${Math.round(a.radResist * 100)}% rad resist`);
        if (a.healMult) bonuses.push(`+${Math.round((a.healMult - 1) * 100)}% healing`);
        if (a.sprintBonus) bonuses.push(`+${Math.round(a.sprintBonus * 100)}% sprint`);
        if (a.lootBonus) bonuses.push(`+${Math.round(a.lootBonus * 100)}% loot`);
        if (a.bleedResist) bonuses.push('clotting');
        if (bonuses.length) html += `<div>Bonus: <b>${bonuses.join(', ')}</b></div>`;
        if (a.set && ARMOR_SETS[a.set]) html += `<div style="color:${ARMOR_SETS[a.set].color}">Set: ${ARMOR_SETS[a.set].name} (2/4/6pc bonuses)</div>`;
        if (a.description) html += `<div class="tt-use">${a.description}</div>`;
        html += `</div>`;
      }
    }

    html += `<div class="tt-meta">Weight ${item.weight} kg • ${priceLine}</div>`;
    t.innerHTML = html;
    t.classList.add('show');
    this._moveTooltip(e);
  }
  _moveTooltip(e) {
    const t = this.el.tooltip;
    t.style.left = (e.clientX + 16) + 'px';
    t.style.top = (e.clientY + 16) + 'px';
  }
  _hideTooltip() { this.el.tooltip.classList.remove('show'); }

  _fmtTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}m ${sec}s`;
  }
}
