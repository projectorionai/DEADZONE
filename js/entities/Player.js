/* Player: WASD movement, sprint/stamina, aim/shoot/melee, health, currency,
 * XP/levels, RPG stats, class/role modifiers.
 * Stats: Strength (carry/melee), Endurance (hp/stamina/drain), Accuracy (spread),
 * Survival (loot fortune), Dexterity (rate of fire), Agility (move speed),
 * Reloading (reload speed).
 *
 * PHASE 3.5: no hunger/thirst, no weapon durability — the loop is combat,
 * loot and progression. Injuries (bleed/fracture/blur/acid) remain: they're
 * combat consequences, not survival busywork. Talents feed recomputeDerived.
 */
class Player extends Entity {
  constructor(x, y) {
    super(x, y, CONFIG.player.radius);
    this.classId = 'soldier';
    this.mods = getClass('soldier').mods;

    this.stamina = CONFIG.player.maxStamina;
    this.currency = CONFIG.player.startingCurrency;
    this.xp = 0; this.level = 1; this.statPoints = 0;
    this.stats = { strength: 1, endurance: 1, accuracy: 1, survival: 1, dexterity: 1, agility: 1, reloading: 1 };

    // === TALENTS ===
    this.skillPoints = 0;
    this.unlockedSkills = [];
    this.skillFx = {};

    // Equipment and weapons
    this.equipped = 'melee';
    this.hasPistol = false;
    this.meleeWeapon = 'melee';
    this.rangedWeapon = null;
    this.mag = 0; this.reloading = false; this.reloadTimer = 0;
    this.fireTimer = 0; this.meleeSwing = 0;

    this.recoilSpread = 0;
    this.weaponSlots = ['melee', null, null];

    // Admin / dev flags
    this.invincible = false;
    this.noclip = false;
    this.infiniteAmmo = false;

    this.invulnTimer = 0; this.hitFlash = 0; this.sprinting = false;
    this.sinceHit = 99; this.bodyH = 40;

    this.companion = null;

    this.abilityTimer = 0;
    this.abilityActive = false;
    this.abilityDuration = 0;

    // === ARMOUR SYSTEM (8 slots, DF1-style: absorbs, wears, repairs, set bonuses) ===
    this.armor = { head: null, face: null, chest: null, arms: null, legs: null, feet: null, back: null, accessory: null };
    this.setBonuses = { fx: {}, active: [], counts: {} };

    // === ENCUMBRANCE ===
    this.weight = new WeightTracker(CONFIG.player.baseCarryWeight || 40);

    // --- Pathogen / Infection ---
    this.infectionLevel = 0;
    this.isInfected = false;
    this._infectionTickTimer = 0;
    this._infectionSpeedPenalty = 1;

    // === INJURIES ===
    this.bleeding = 0;        // seconds of bleed left (DoT)
    this.fractured = false;   // broken bone: hobble + no sprint
    this.fractureTimer = 0;
    this.blur = 0;            // seconds of bile-blur left
    this.acid = 0;            // seconds of acid burn left

    this.recomputeDerived();
    this.hp = this.maxHp;
  }

  applyClass(classId) {
    const c = getClass(classId);
    this.classId = classId;
    this.mods = c.mods;
    this.stats = Object.assign(
      { strength: 1, endurance: 1, accuracy: 1, survival: 1, dexterity: 1, agility: 1, reloading: 1 },
      c.stats);
    this.meleeWeapon = 'melee';
    this.rangedWeapon = null;
    for (const k of (c.kit || [])) {
      const it = ITEMS[k.id];
      const w = it && it.weaponId ? getWeapon(it.weaponId) : null;
      if (!w) continue;
      if (w.kind === 'melee') this.meleeWeapon = w.id;
      else if (w.kind === 'ranged') this.rangedWeapon = w.id;
    }
    this.equipped = getWeapon(c.startWeapon) ? c.startWeapon : this.meleeWeapon;
    this.hasPistol = !!this.rangedWeapon;
    const rw = getWeapon(this.rangedWeapon);
    this.mag = rw ? rw.magSize : 0;
    this.weaponSlots = [this.meleeWeapon, this.rangedWeapon, null];

    if (c.mods && c.mods.companion && !this.companion) {
      this.companion = new Companion(this.x + 30, this.y + 30, this);
    }

    this.abilityTimer = 0; this.abilityActive = false; this.abilityDuration = 0;
    this.reloading = false; this.fireTimer = 0;
    this.skillPoints = 0; this.unlockedSkills = [];
    this.bleeding = 0; this.fractured = false; this.blur = 0; this.acid = 0;

    this.recomputeDerived();
    this.hp = this.maxHp; this.stamina = this.maxStamina;
  }

  // Armor pieces can carry passive bonuses (speed, carry, stealth, bile/rad resist).
  _armorBonus(key) {
    let v = 0;
    if (!this.armor) return 0;
    for (const slot of ARMOR_SLOTS) {
      const inst = this.armor[slot];
      if (inst && !inst.isBroken && inst.def[key]) v += inst.def[key];
    }
    // set bonuses can add the same keys
    if (this.setBonuses && this.setBonuses.fx[key]) v += this.setBonuses.fx[key];
    return v;
  }

  recomputeDerived() {
    const P = CONFIG.progression, m = this.mods;
    const S = this.stats;
    const end = S.endurance - 1;
    const str = S.strength - 1;
    const agi = (S.agility || 1) - 1;
    const rel = (S.reloading || 1) - 1;
    const dex = (S.dexterity || 1) - 1;

    // === TALENTS: merged effect bag ===
    const fx = this.skillFx = (typeof collectSkillEffects === 'function')
      ? collectSkillEffects(this.unlockedSkills) : {};
    // === ARMOUR SETS: matching pieces unlock 2/4/6-piece bonuses ===
    this.setBonuses = (typeof collectSetBonuses === 'function')
      ? collectSetBonuses(this.armor) : { fx: {}, active: [], counts: {} };
    const sb = this.setBonuses.fx;

    this.maxHp = Math.round((CONFIG.player.maxHealth + end * P.enduranceHpPerPoint + (fx.hpBonus || 0)) * (m.maxHpMult || 1));
    this.maxStamina = CONFIG.player.maxStamina + end * P.endStaminaPerPoint;

    const baseCarry = CONFIG.player.baseCarryWeight || 40;
    const strengthBonus = str * (P.strengthCarryPerPoint || 3);
    this.maxCarryWeight = (baseCarry + strengthBonus + (fx.carryBonus || 0) + this._armorBonus('carryBonus')) * (m.carryMult || 1);
    this.weight.maxWeight = this.maxCarryWeight;

    this.meleeMult = (1 + str * P.strengthMeleePerPoint) * (m.meleeMult || 1) * (fx.meleeMult || 1);
    this.rangedMult = m.rangedMult || 1;
    this.spreadReduce = (S.accuracy - 1) * P.accuracySpreadPerPoint;
    this.spreadMult = (m.spreadMult || 1) * (fx.spreadMult || 1);
    this.lootBonus = (S.survival - 1) * P.survivalLootPerPoint + (fx.lootBonus || 0) + (sb.lootBonus || 0);
    this.lootMult = m.lootMult || 1;
    this.lootDiscovery = m.lootDiscovery || 0;
    this.materialMult = m.materialMult || 1;

    // === AGILITY: flat-out faster on your feet ===
    this.speedMult = (m.speedMult || 1) * (1 + agi * (P.agilitySpeedPerPoint || 0.025))
      * (1 + (fx.speedBonus || 0)) * (1 + this._armorBonus('speedBonus'));
    this.sprintMult = (1 + end * 0.03) * (1 + (fx.sprintBonus || 0) + this._armorBonus('sprintBonus'));

    // === ENDURANCE: sprinting drains slower ===
    this.staminaDrainMult = (1 / (1 + end * (P.endDrainPerPoint || 0.05))) * (fx.drainMult || 1);
    this.staminaRegenMult = fx.staminaRegenMult || 1;

    // === DEXTERITY: rate of fire ===
    this.fireRateMult = (m.fireRateMult || 1) * (1 + dex * (P.dexterityFirePerPoint || 0.04)) * (fx.fireRateMult || 1);

    // === RELOADING ===
    this.reloadMult = (1 + rel * (P.reloadingPerPoint || 0.07)) * (1 + (fx.reloadBonus || 0));

    // Unique signature weapons grant passive buffs while wielded.
    const heldBuff = (typeof getWeapon === 'function' && getWeapon(this.equipped) && getWeapon(this.equipped).buff) || {};

    this.detectMult = m.detectMult || 1;
    this.stealth = (m.stealth || 1) * (fx.stealthMult || 1) * (heldBuff.stealthMult || 1);
    this.speedMult *= (1 + (heldBuff.speedBonus || 0));
    this.critChance = (m.critChance || 0) + (fx.critChance || 0) + (heldBuff.critChance || 0);
    this.critDamage = 2 + (fx.critDamage || 0);          // crit multiplier
    this.heavyBonus = fx.heavyBonus || 0;                // heavy-weapon handling
    this.abilityCdMult = 1 - Math.min(0.5, fx.abilityCd || 0);
    this.armorWearMult = 1 - Math.min(0.6, fx.armorWear || 0);
    this.regen = (m.regen || 0) + (fx.regen || 0);
    this.healMult = (m.healMult || 1) * (fx.healMult || 1) * (sb.healMult || 1);
    this.damageReduc = (m.damageReduc || 0) + (fx.damageReduc || 0) + (sb.damageReduc || 0) + (heldBuff.damageReduc || 0);
    this.haggle = m.haggle || 1;
    this.canCraft = !!m.craft;
    this.headshotBonus = fx.headshotBonus || 0;
    this.bleedResist = (fx.bleedResist || 1) * (sb.bleedResist ? (1 - sb.bleedResist) : 1);
    this.fractureResist = (fx.fractureResist || 1) * (sb.fractureResist ? (1 - sb.fractureResist) : 1);
    this.blurResist = 1 - Math.min(0.9, this._armorBonus('blurResist'));
    this.radResist = 1 - Math.min(0.9, this._armorBonus('radResist'));

    this.hp = Math.min(this.hp || this.maxHp, this.maxHp);
    this.stamina = Math.min(this.stamina, this.maxStamina);
  }

  get carryWeight() { return this.maxCarryWeight; }

  // === TALENTS ===
  unlockSkill(id) {
    const check = canUnlockSkill(this, id);
    if (!check.ok) return check;
    const s = SKILL_TREE[id];
    this.skillPoints -= s.cost;
    this.unlockedSkills.push(id);
    this.recomputeDerived();
    return { ok: true };
  }
  // Total points earned so far (levels), for respec refunds.
  totalSkillPointsEarned() {
    return (this.level - 1) * (CONFIG.progression.skillPointsPerLevel || 1);
  }
  respecTalents() {
    this.unlockedSkills = [];
    this.skillPoints = this.totalSkillPointsEarned();
    this.recomputeDerived();
  }

  isInvuln() { return this.invulnTimer > 0; }

  // === ARMOUR: total damage reduction across all 8 slots (weighted) ===
  getTotalDamageReduction() {
    if (!this.armor) return 0;
    let reduction = 0;
    for (const slot of ARMOR_SLOTS) {
      const inst = this.armor[slot];
      if (inst instanceof ArmorInstance) reduction += inst.getDamageReduction() * (SLOT_DR_WEIGHT[slot] || 0);
    }
    return Math.min(0.85, reduction);
  }

  // Total armour rating (sum of raw piece ratings, for the armour sheet)
  getArmorRating() {
    let r = 0;
    for (const slot of ARMOR_SLOTS) {
      const inst = this.armor && this.armor[slot];
      if (inst instanceof ArmorInstance && !inst.isBroken) r += Math.round(inst.def.damageReduction * 100);
    }
    return r;
  }

  // Aura / environmental damage — bypasses i-frames but is scaled by rad resist.
  takeAuraDamage(amount, from, game) {
    if (this.invincible || this.dead) return;
    this.hp -= amount * (this.radResist || 1);
    this._radTick = (this._radTick || 0) + amount;
    if (this._radTick > 4 && game) {
      this._radTick = 0;
      game.entities.addText(this.x, this.y - 26, 'RADIATION', '#7ad46a');
      if (game.audio) game.audio.geiger();
    }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  // Bile to the face: heavy blur + acid DoT (mitigated by sealed headgear).
  applyBlur(game) {
    const dur = CONFIG.injury.blurDuration * (this.blurResist || 1);
    if (dur < 0.5) return;
    this.blur = Math.max(this.blur, dur);
    if (game && game.ui) game.ui.toast('🤢 Bile in your eyes — you can barely see!');
    if (game && game.audio) game.audio.splat();
  }

  // Acid contact: short caustic burn status.
  applyAcid(game, dur = 2) {
    this.acid = Math.max(this.acid, dur);
  }

  takeDamage(amount, from, knockback = CONFIG.zombie.contactPush, opts = {}) {
    if (this.invincible || this.isInvuln() || this.dead) return;

    const armorReduction = this.getTotalDamageReduction();
    const armoredAmount = amount * (1 - armorReduction);

    // Armor soaks the hit and wears down (Engineering talents slow the wear)
    const wear = this.armorWearMult || 1;
    const WEAR_TABLE = { chest: [1, 0.7], head: [0.2, 0.3], legs: [0.15, 0.2], arms: [0.15, 0.2], feet: [0.1, 0.15], face: [0.1, 0.1] };
    for (const [slot, [chance, frac]] of Object.entries(WEAR_TABLE)) {
      const inst = this.armor && this.armor[slot];
      if (inst instanceof ArmorInstance && Math.random() < chance) inst.takeDamage(amount * frac * wear);
    }

    const mitigated = armoredAmount * (1 - this.damageReduc);
    this.hp -= mitigated;
    this.hitFlash = 0.18; this.sinceHit = 0;
    this.invulnTimer = CONFIG.player.invulnFrames;

    const I = CONFIG.injury;
    const game = window.game;

    // === INJURY: claw wounds can open a bleed ===
    if (from && from.cfg && this.bleeding <= 0 && Utils.chance(I.bleedChance * (this.bleedResist || 1))) {
      this.bleeding = I.bleedDuration;
      if (game && game.ui) game.ui.toast('🩸 You are bleeding — bandage it before it drains you');
    }

    // === INJURY: heavy impacts can break bone ===
    if (mitigated >= I.fractureThreshold && !this.fractured) {
      const chance = (opts.boneBreaker ? I.fractureBruteChance : I.fractureChance) * (this.fractureResist || 1);
      if (Utils.chance(chance)) {
        this.fractured = true;
        this.fractureTimer = I.fractureSelfHeal;
        if (game && game.ui) game.ui.toast('🦴 CRACK — something broke. You can barely walk. Splint it (bandage)!');
        if (game && game.audio) game.audio.boneCrack();
      }
    }

    // --- Infection chance on hit from zombie entities ---
    if (from && from.cfg && !this.isInfected && Utils.chance(0.18)) {
      this.isInfected = true;
      this.infectionLevel = Math.max(this.infectionLevel, 5);
      if (game && game.ui) game.ui.toast('⚠ You feel the pathogen take hold...');
    }

    if (from) {
      const a = Utils.angle(from.x, from.y, this.x, this.y);
      this.x += Math.cos(a) * knockback * 0.35;
      this.y += Math.sin(a) * knockback * 0.35;
      const sc = game && game.scene;
      if (sc) Collision.resolveCircle(this, this.radius, sc.moveSolids || sc.solids);
    }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount * this.healMult); }
  restoreStamina(amount) { this.stamina = Math.min(this.maxStamina, this.stamina + amount); }

  // Treat wounds: bandages stop bleeding, splint fractures, neutralise acid.
  treatWounds(game) {
    let treated = false;
    if (this.bleeding > 0) { this.bleeding = 0; treated = true; if (game) game.ui.toast('Bleeding stopped'); }
    if (this.fractured) {
      this.fractured = false; this.fractureTimer = 0; treated = true;
      if (game) game.ui.toast('Bone splinted — you can move again');
    }
    if (this.acid > 0) { this.acid = 0; treated = true; }
    return treated;
  }

  // === ARMOR equip/unequip ===
  equipArmor(armorInstance, slot = null) {
    if (!(armorInstance instanceof ArmorInstance)) return false;
    const armorSlot = slot || armorInstance.def.slot || 'chest';
    this.armor[armorSlot] = armorInstance;
    if (this.weight) this.weight.updateFromArmor(this.armor);
    this.recomputeDerived();
    return true;
  }

  equipArmorItem(itemId) {
    const it = ITEMS[itemId];
    const def = it && it.armorId ? getArmorDef(it.armorId) : null;
    if (!it || it.type !== 'armor' || !def) return { ok: false };
    const slot = ARMOR_SLOTS.includes(def.slot) ? def.slot : 'chest';
    const prev = this.armor[slot];
    this.armor[slot] = new ArmorInstance(it.armorId);
    if (this.weight && this.weight.updateFromArmor) this.weight.updateFromArmor(this.armor);
    this.recomputeDerived();
    return { ok: true, slot, prevItem: prev ? Player.itemIdForArmor(prev.id) : null };
  }

  unequipArmor(slot) {
    const inst = this.armor[slot];
    if (!inst) return null;
    this.armor[slot] = null;
    if (this.weight && this.weight.updateFromArmor) this.weight.updateFromArmor(this.armor);
    this.recomputeDerived();
    return Player.itemIdForArmor(inst.id);
  }

  static itemIdForArmor(armorId) {
    for (const k of Object.keys(ITEMS)) if (ITEMS[k].armorId === armorId) return k;
    return null;
  }

  update(dt, input, game) {
    if (this.dead) return;
    const solids = game.scene.moveSolids || game.scene.solids;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.meleeSwing > 0) this.meleeSwing -= dt;
    if (this.recoilSpread > 0) this.recoilSpread = Math.max(0, this.recoilSpread - dt * 0.7);
    if (this.abilityTimer > 0) this.abilityTimer -= dt;
    if (this.abilityDuration > 0) {
      this.abilityDuration -= dt;
      if (this.abilityDuration <= 0) {
        this.abilityActive = false;
        this.recomputeDerived();
      }
    }
    this.sinceHit += dt;
    if (this.regen > 0 && this.sinceHit > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    this._updateInjuries(dt, game);

    // Movement
    let dx = 0, dy = 0;
    if (input.isDown('w') || input.isDown('arrowup')) dy -= 1;
    if (input.isDown('s') || input.isDown('arrowdown')) dy += 1;
    if (input.isDown('a') || input.isDown('arrowleft')) dx -= 1;
    if (input.isDown('d') || input.isDown('arrowright')) dx += 1;
    const moving = dx !== 0 || dy !== 0;
    if (moving) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; }

    const canSprintLogic = (!this.weight || this.weight.canSprint()) && !this.fractured;
    const wantSprint = input.isDown('shift') && moving && this.stamina > CONFIG.player.sprintMinStamina && canSprintLogic;
    this.sprinting = wantSprint;

    const weightSpeedMult = this.weight ? this.weight.getSpeedMultiplier() : 1.0;
    let speed = (wantSprint ? CONFIG.player.sprintSpeed * (this.sprintMult || 1) : CONFIG.player.walkSpeed) * this.speedMult * weightSpeedMult;

    if (wantSprint) {
      const staminaDrain = CONFIG.player.staminaDrain * (this.staminaDrainMult || 1);
      const weightStaminaMult = this.weight ? this.weight.getStaminaDrainMultiplier() : 1.0;
      this.stamina = Math.max(0, this.stamina - staminaDrain * weightStaminaMult * dt);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + CONFIG.player.staminaRegen * (this.staminaRegenMult || 1) * dt);
    }

    speed *= (this._infectionSpeedPenalty || 1);
    if (this.fractured) speed *= CONFIG.injury.fractureSpeedMult;
    this.vx = dx * speed; this.vy = dy * speed;
    if (this.noclip) { this.x += this.vx * dt; this.y += this.vy * dt; }
    else this.moveAndCollide(dt, solids);
    this.x = Utils.clamp(this.x, this.radius, game.scene.w - this.radius);
    this.y = Utils.clamp(this.y, this.radius, game.scene.h - this.radius);

    this.facing = Utils.angle(this.x, this.y, input.mouse.worldX, input.mouse.worldY);

    // Weapon slots — hotkeys 1 / 2 / 3, Q cycles
    if (input.wasPressed('1') && this.weaponSlots[0]) this.equipWeapon(this.weaponSlots[0]);
    if (input.wasPressed('2') && this.weaponSlots[1]) this.equipWeapon(this.weaponSlots[1]);
    if (input.wasPressed('3') && this.weaponSlots[2]) this.equipWeapon(this.weaponSlots[2]);
    if (input.wasPressed('q')) {
      const owned = this.weaponSlots.filter(Boolean);
      if (owned.length) { const idx = (owned.indexOf(this.equipped) + 1) % owned.length; this.equipWeapon(owned[idx]); }
    }

    // --- Infection progression (cure with antivirals) ---
    if (this.isInfected && !this.invincible) {
      this._infectionTickTimer += dt;
      const tickInterval = 4.0;
      while (this._infectionTickTimer >= tickInterval) {
        this._infectionTickTimer -= tickInterval;
        this.infectionLevel = Math.min(100, this.infectionLevel + 3.5);
        this._infectionSpeedPenalty = Math.max(0.55, 1 - this.infectionLevel * 0.0045);
        if (this.infectionLevel >= 80 && !this._infWarned) {
          this._infWarned = true;
          if (game && game.ui) game.ui.toast('⚠ Infection reaching critical stage — find antivirals!');
        }
      }
    } else if (!this.isInfected) {
      this._infectionSpeedPenalty = 1;
      this._infWarned = false;
    }

    const wpn = getWeapon(this.equipped);
    if (wpn && wpn.kind === 'ranged') {
      if (this.reloading) { this.reloadTimer -= dt; if (this.reloadTimer <= 0) this._finishReload(game); }
      else if (input.wasPressed('r') && this.mag < wpn.magSize) this._startReload(game);
    }

    if (input.mouse.down && this.fireTimer <= 0) {
      if (wpn && wpn.kind === 'ranged') this._shoot(game); else this._melee(game);
    }
  }

  // === INJURIES: per-frame effects ===
  _updateInjuries(dt, game) {
    const I = CONFIG.injury;
    if (this.bleeding > 0) {
      const rate = (this.skillFx && this.skillFx.bleedResist) ? 1 / this.skillFx.bleedResist : 1;
      this.bleeding -= dt * rate;
      if (!this.invincible) {
        this.hp -= I.bleedDps * dt;
        if (this.hp <= 0) { this.hp = 0; this.dead = true; }
      }
      if (Math.random() < dt * 2 && game) game.entities.addSpark(this.x, this.y, '#a01818', 1);
    }
    if (this.fractured) {
      this.fractureTimer -= dt;
      if (this.fractureTimer <= 0) {
        this.fractured = false;
        if (game && game.ui) game.ui.toast('Your bone has knitted — walking normally again');
      }
    }
    if (this.blur > 0) {
      this.blur -= dt;
      if (!this.invincible && CONFIG.injury.blurDps) {
        this.hp = Math.max(1, this.hp - CONFIG.injury.blurDps * dt);
      }
    }
    if (this.acid > 0) {
      this.acid -= dt;
      if (!this.invincible) {
        this.hp = Math.max(1, this.hp - 2.4 * dt);
        if (Math.random() < dt * 3 && game) game.entities.addSpark(this.x, this.y, '#8fdf5a', 1);
      }
    }
  }

  equipWeapon(id) {
    const w = getWeapon(id);
    if (!w) return;
    // Tiered arsenal: you grow INTO the big guns.
    if (w.levelReq && this.level < w.levelReq) {
      if (window.game && window.game.ui) window.game.ui.toast(`🔒 ${w.name} requires level ${w.levelReq}`);
      return;
    }
    this.equipped = id;
    this.reloading = false;
    this.recomputeDerived();   // unique-weapon buffs apply/drop on swap
    if (w.kind === 'ranged') {
      this.rangedWeapon = id; this.hasPistol = true;
      this.mag = this.infiniteAmmo ? w.magSize : Math.min(this.mag, w.magSize);
    } else {
      this.meleeWeapon = id;
    }
    if (!this.weaponSlots.includes(id)) {
      if (w.kind === 'melee') this.weaponSlots[0] = id;
      else if (!this.weaponSlots[1]) this.weaponSlots[1] = id;
      else this.weaponSlots[2] = id;
    }
  }

  // === CRITS ===
  _getCritChance(weapon) {
    const baseChance = weapon.critBase || weapon.baseCrit || 0;
    const dexterity = this.stats?.dexterity || 1;
    const dexBonus = (dexterity - 1) * 0.005;
    return Math.min(0.5, baseChance + dexBonus + (this.critChance || 0));
  }

  _getReloadTime(weapon) {
    if (!weapon.reloadTime) return 0;
    return weapon.reloadTime / Math.max(0.5, this.reloadMult || 1);
  }

  _rollCrit(weapon) {
    return Utils.chance(this._getCritChance(weapon));
  }

  _shoot(game) {
    if (this.reloading) return;
    const w = getWeapon(this.equipped) || getWeapon('pistol');
    if (this.mag <= 0 && !this.infiniteAmmo) { game.ui.toast('*click* — reload (R)'); this.fireTimer = 0.2; return; }

    if (!this.infiniteAmmo) this.mag--;
    // Heavy Weapons talent: better handling on 'heavy' archetype guns
    const heavy = (w.archetype === 'heavy') ? (this.heavyBonus || 0) : 0;
    this.fireTimer = (w.fireRate / this.fireRateMult) * (1 - heavy * 0.5);
    const spread = Math.max(0.003,
      (w.spread - this.spreadReduce) * this.spreadMult * (1 - heavy) + this.recoilSpread);
    const crit = this._rollCrit(w);

    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    const rx = Math.sin(this.facing), ry = -Math.cos(this.facing);
    const mx = this.x + fx * (this.radius + 16) + rx * 8;
    const my = this.y + fy * (this.radius + 16) + ry * 8;
    const pellets = w.pellets || 1;

    // FLAMETHROWER: no projectile — a cone of fire that ignites everything in it.
    if (w.flame) {
      const F = w.flame;
      for (let i = 0; i < 5; i++) {
        const a = this.facing + Utils.rand(-F.arc / 2, F.arc / 2);
        const r = Utils.rand(F.range * 0.3, F.range);
        game.entities.particles.push({
          wx: mx, wy: my, wz: 20, vx: Math.cos(a) * r * 2.2, vy: Math.sin(a) * r * 2.2,
          life: 0.4, max: 0.4, color: Utils.pick(['#ff9a30', '#ffce50', '#ff6a20']), size: Utils.rand(3, 6),
        });
      }
      for (const z of game.entities.zombies) {
        if (!z.alive) continue;
        const d = Utils.dist(this.x, this.y, z.x, z.y);
        if (d > F.range + z.radius) continue;
        const a = Utils.angle(this.x, this.y, z.x, z.y);
        const diff = Math.abs(((a - this.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff > F.arc / 2) continue;
        if (Collision.segBlocked(this.x, this.y, z.x, z.y, game.scene.solids)) continue;
        z.burn = Math.max(z.burn || 0, F.burn);   // set them ablaze (DoT)
        const res = z.takeHit(w.damage * this.rangedMult, false);
        game.onZombieHit(z, res, z.x, z.y, false, 'player');
      }
      if (game.audio) game.audio.gunshot(w);
      if (w.noise && game.alertZombies) game.alertZombies(this.x, this.y, w.noise);
      return;
    }

    for (let i = 0; i < pellets; i++) {
      const ang = this.facing + Utils.rand(-spread, spread);
      const dmg = w.damage * this.rangedMult * (crit ? (this.critDamage || 2) : 1);
      const b = new Bullet(mx, my, ang, dmg, 'player', crit, w.bulletSpeed, w.range);
      if (w.explosive) b.explosive = w.explosive;   // grenades/rockets detonate on death
      game.entities.spawnBullet(b);
    }
    this.recoilSpread = Math.min(0.55, this.recoilSpread + (w.recoil || 0.02) * (1 - heavy * 0.5));
    game.addMuzzleFlash(mx, my, this.facing);
    if (game.audio) game.audio.gunshot(w);
    if (game.analytics) game.analytics.shot(w);
    if (w.noise && game.alertZombies) game.alertZombies(this.x, this.y, w.noise);
    if (this.mag === 0 && !this.infiniteAmmo) game.ui.toast(`${w.name} empty — R to reload`);
  }

  _startReload(game) {
    const w = getWeapon(this.equipped); if (!w || w.kind !== 'ranged') return;
    if (!this.infiniteAmmo && game.inventory.count(w.ammoItem) <= 0) { game.ui.toast(`No ${w.ammoType} ammo!`); return; }
    this.reloading = true;
    this.reloadTimer = this._getReloadTime(w);
    if (game.audio) game.audio.reload();
    game.ui.toast('Reloading...');
  }

  _finishReload(game) {
    const w = getWeapon(this.equipped); if (!w) { this.reloading = false; return; }
    const need = w.magSize - this.mag;
    const take = this.infiniteAmmo ? need : Math.min(need, game.inventory.count(w.ammoItem));
    if (!this.infiniteAmmo) game.inventory.remove(w.ammoItem, take);
    this.mag += take; this.reloading = false;
    game.ui.toast(take > 0 ? `Reloaded (${this.mag}/${w.magSize})` : 'No ammo to reload');
  }

  _melee(game) {
    const cur = getWeapon(this.equipped);
    const w = (cur && cur.kind === 'melee') ? cur : (getWeapon(this.meleeWeapon) || getWeapon('melee'));
    this.fireTimer = w.fireRate; this.meleeSwing = 0.18;

    if (game.audio) game.audio.swing();
    if (w.noise && game.alertZombies) game.alertZombies(this.x, this.y, w.noise);
    const crit = this._rollCrit(w);
    const dmg = w.damage * this.meleeMult * (crit ? (this.critDamage || 2) : 1);
    let hits = 0;
    for (const z of game.entities.zombies) {
      if (!z.alive) continue;
      const d = Utils.dist(this.x, this.y, z.x, z.y);
      if (d > w.range + z.radius) continue;
      const a = Utils.angle(this.x, this.y, z.x, z.y);
      const diff = Math.abs(((a - this.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff <= w.arc / 2) { game.onZombieHit(z, z.takeHit(dmg, false), z.x, z.y, crit, 'player'); hits++; }
    }
    if (hits > 0) game.addMeleeArc(this.x, this.y, this.facing);
  }

  // Progression
  addXP(amount, game) {
    const cap = CONFIG.progression.levelCap || 220;
    if (this.level >= cap) return;
    this.xp += amount; let leveled = false;
    while (this.level < cap && this.xp >= this.xpForNext()) {
      this.xp -= this.xpForNext(); this.level++;
      this.statPoints += CONFIG.progression.statPointsPerLevel;
      this.skillPoints += CONFIG.progression.skillPointsPerLevel || 0;
      leveled = true;
    }
    if (this.level >= cap) this.xp = 0;
    if (leveled) {
      this.recomputeDerived(); this.hp = this.maxHp; this.stamina = this.maxStamina;
      if (game) {
        game.ui.toast(`LEVEL UP! Level ${this.level} (+${CONFIG.progression.statPointsPerLevel} stat, +${CONFIG.progression.skillPointsPerLevel} talent pts)`);
        if (game.audio) game.audio.levelUp();
      }
    }
  }
  // Polynomial climb to the 220 cap: L2 costs 1000, L10 ~4.5k, L50 ~28k...
  xpForNext() {
    return Math.round((CONFIG.progression.xpBase || 1000) *
      Math.pow(this.level, CONFIG.progression.xpPower || 1.35));
  }
  spendStat(name) { if (this.statPoints <= 0 || !(name in this.stats)) return false; this.stats[name]++; this.statPoints--; this.recomputeDerived(); return true; }

  collect(list) { list.add(Iso.depth(this.x, this.y) + 1, (ctx) => this.render(ctx)); }
  render(ctx) {
    const cls = getClass(this.classId);
    Iso.shadow(ctx, this.x, this.y, 0.8, 0);
    if (this.meleeSwing > 0 && this.equipped === 'melee') {
      const w = getWeapon('melee');
      const c = Iso.toScreen(this.x, this.y, 8);
      ctx.fillStyle = 'rgba(230,230,240,0.14)';
      ctx.beginPath(); ctx.moveTo(c.x, c.y);
      for (let a = -w.arc / 2; a <= w.arc / 2; a += 0.2) {
        const p = Iso.toScreen(this.x + Math.cos(this.facing + a) * w.range, this.y + Math.sin(this.facing + a) * w.range, 8);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath(); ctx.fill();
    }
    Iso.actor(ctx, this.x, this.y, {
      radius: this.radius, bodyH: this.bodyH,
      body: cls.color, light: Iso._lighten(cls.color, 30), dark: Iso.shade(cls.color, 0.55),
      head: '#c9a98a', flash: this.hitFlash > 0,
      facing: this.facing, arm: this.equipped === 'pistol' ? '#e8e8e8' : '#c9a066',
      armLen: this.equipped === 'pistol' ? 26 : 30, armW: 5,
    });
    if (this.isInvuln() && Math.floor(this.invulnTimer * 20) % 2 === 0) {
      const p = Iso.toScreen(this.x, this.y, this.bodyH / 2);
      ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, this.radius * Iso.IX * 3, this.radius * Iso.IY * 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  serialize() {
    return {
      classId: this.classId, x: this.x, y: this.y, hp: this.hp, stamina: this.stamina,
      currency: this.currency, xp: this.xp, level: this.level, statPoints: this.statPoints,
      stats: { ...this.stats }, equipped: this.equipped, hasPistol: this.hasPistol, mag: this.mag,
      weaponSlots: this.weaponSlots.slice(), meleeWeapon: this.meleeWeapon, rangedWeapon: this.rangedWeapon,
      skillPoints: this.skillPoints,
      unlockedSkills: this.unlockedSkills.slice(),
      bleeding: this.bleeding, fractured: this.fractured, fractureTimer: this.fractureTimer,
      armor: Object.fromEntries(ARMOR_SLOTS.map(s => [s, this.armor?.[s]?.serialize?.() ?? null])),
      weight: this.weight?.serialize?.() ?? null,
      infectionLevel: this.infectionLevel,
      isInfected: this.isInfected,
    };
  }

  load(d) {
    if (!d) return;
    this.classId = d.classId || 'soldier';
    this.mods = getClass(this.classId).mods;
    this.stats = Object.assign(
      { strength: 1, endurance: 1, accuracy: 1, survival: 1, dexterity: 1, agility: 1, reloading: 1 },
      d.stats || {});
    Object.assign(this, {
      x: d.x, y: d.y, currency: d.currency, xp: d.xp, level: d.level,
      statPoints: d.statPoints, equipped: d.equipped, hasPistol: !!d.hasPistol, mag: d.mag || 0
    });
    if (d.weaponSlots) this.weaponSlots = d.weaponSlots;
    if (d.meleeWeapon) this.meleeWeapon = d.meleeWeapon;
    if (d.rangedWeapon) this.rangedWeapon = d.rangedWeapon;

    // === TALENTS (migration: refund points from talents that no longer exist) ===
    this.skillPoints = d.skillPoints || 0;
    this.unlockedSkills = [];
    if (Array.isArray(d.unlockedSkills)) {
      for (const id of d.unlockedSkills) {
        if (SKILL_TREE[id]) this.unlockedSkills.push(id);
        else this.skillPoints += 1;   // legacy node — refund its point
      }
    }

    this.bleeding = d.bleeding || 0;
    this.fractured = !!d.fractured;
    this.fractureTimer = d.fractureTimer || 0;

    this.infectionLevel = d.infectionLevel || 0;
    this.isInfected = d.isInfected || false;

    // Restore armour — RE-SLOT each piece by its current def.slot so pieces
    // whose slot moved in a catalogue update (e.g. boots legs→feet) land right.
    try {
      if (d.armor) {
        for (const data of Object.values(d.armor)) {
          if (!data || !ARMOR_TYPES[data.id]) continue;
          const inst = ArmorInstance.deserialize(data);
          const slot = ARMOR_SLOTS.includes(inst.def.slot) ? inst.def.slot : 'chest';
          this.armor[slot] = inst;
        }
      }
    } catch (e) { console.warn('Armor restore skipped:', e); }

    if (d.weight) this.weight = WeightTracker.deserialize(d.weight);

    this.recomputeDerived();
    this.hp = Utils.clamp(d.hp, 0, this.maxHp);
    this.stamina = Utils.clamp(d.stamina, 0, this.maxStamina);
  }
}
