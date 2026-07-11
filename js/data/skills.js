/* TALENT SYSTEM — Dead Frontier proficiencies, rebuilt as a visual tree.
 * Ten categories, three ranks each. Rank N requires rank N-1; costs rise 1/1/2.
 * Effects are flat modifier objects merged in Player.recomputeDerived().
 * (The constant keeps the SKILL_TREE name so save/Player code stays stable.)
 */

const TALENT_CATEGORIES = {
  accuracy:  { name: 'Accuracy',      icon: '🎯', color: '#c9a13a', desc: 'Tighter spread, truer shots.' },
  reloading: { name: 'Reloading',     icon: '🔄', color: '#5a9ac9', desc: 'Hands that never fumble.' },
  critical:  { name: 'Critical Hits', icon: '💥', color: '#e0604a', desc: 'Find the weak points.' },
  endurance: { name: 'Endurance',     icon: '❤',  color: '#c94a5a', desc: 'Take a beating, keep walking.' },
  agility:   { name: 'Agility',       icon: '⚡', color: '#6ad06a', desc: 'Speed is survival.' },
  medic:     { name: 'Medic',         icon: '✚',  color: '#5fae7a', desc: 'Every bandage goes further.' },
  heavy:     { name: 'Heavy Weapons', icon: '⚙',  color: '#9a8a5a', desc: 'Tame the big guns.' },
  melee:     { name: 'Melee',         icon: '🔪', color: '#b0785c', desc: 'Quiet, cheap, brutal.' },
  looting:   { name: 'Looting',       icon: '💰', color: '#c9b13a', desc: 'The city provides — to those who look.' },
  engineering:{ name: 'Engineering',  icon: '🔧', color: '#7a8a9c', desc: 'Keep the gear running.' },
};

// rank -> cost
const TALENT_COSTS = [1, 1, 2];

/* Per-category rank effects (index 0 = rank 1). Keys are consumed by
 * Player.recomputeDerived — 'Mult' suffixed keys multiply, others add. */
const TALENT_RANKS = {
  accuracy: [
    { desc: '-12% weapon spread.',            effect: { spreadMult: 0.88 } },
    { desc: '-12% further weapon spread.',    effect: { spreadMult: 0.88 } },
    { desc: '-15% further spread.',           effect: { spreadMult: 0.85 } },
  ],
  reloading: [
    { desc: '+12% reload speed.',             effect: { reloadBonus: 0.12 } },
    { desc: '+12% further reload speed.',     effect: { reloadBonus: 0.12 } },
    { desc: '+16% further reload speed.',     effect: { reloadBonus: 0.16 } },
  ],
  critical: [
    { desc: '+4% critical chance.',           effect: { critChance: 0.04 } },
    { desc: '+35% critical damage.',          effect: { critDamage: 0.35 } },
    { desc: '+4% crit chance, +40% crit damage.', effect: { critChance: 0.04, critDamage: 0.4 } },
  ],
  endurance: [
    { desc: '+15 max health.',                effect: { hpBonus: 15 } },
    { desc: '+20 further max health.',        effect: { hpBonus: 20 } },
    { desc: '+25 health; fractures half as likely.', effect: { hpBonus: 25, fractureResist: 0.5 } },
  ],
  agility: [
    { desc: '+4% movement speed.',            effect: { speedBonus: 0.04 } },
    { desc: 'Sprinting drains 15% less.',     effect: { drainMult: 0.85 } },
    { desc: '+5% speed, +25% stamina regen.', effect: { speedBonus: 0.05, staminaRegenMult: 1.25 } },
  ],
  medic: [
    { desc: '+20% healing from items.',       effect: { healMult: 1.2 } },
    { desc: 'Bleeding ends twice as fast.',   effect: { bleedResist: 0.5 } },
    { desc: '+25% healing; slow regeneration.', effect: { healMult: 1.25, regen: 0.5 } },
  ],
  heavy: [
    { desc: '+15% heavy weapon handling.',    effect: { heavyBonus: 0.15 } },
    { desc: '+15% further heavy handling.',   effect: { heavyBonus: 0.15 } },
    { desc: '+20% further heavy handling.',   effect: { heavyBonus: 0.2 } },
  ],
  melee: [
    { desc: '+12% melee damage.',             effect: { meleeMult: 1.12 } },
    { desc: '+12% further melee damage.',     effect: { meleeMult: 1.12 } },
    { desc: '+16% melee damage.',             effect: { meleeMult: 1.16 } },
  ],
  looting: [
    { desc: '+10% loot fortune.',             effect: { lootBonus: 0.10 } },
    { desc: '+10% further loot fortune.',     effect: { lootBonus: 0.10 } },
    { desc: '+15% loot fortune.',             effect: { lootBonus: 0.15 } },
  ],
  engineering: [
    { desc: 'Armour wears 15% slower.',       effect: { armorWear: 0.15 } },
    { desc: 'Ability cooldowns -12%.',        effect: { abilityCd: 0.12 } },
    { desc: 'Armour wear -20%, cooldowns -12%.', effect: { armorWear: 0.2, abilityCd: 0.12 } },
  ],
};

// Build the flat SKILL_TREE: ids like 'accuracy_1'.
const SKILL_TREE = {};
for (const [catId, cat] of Object.entries(TALENT_CATEGORIES)) {
  (TALENT_RANKS[catId] || []).forEach((rank, i) => {
    const id = `${catId}_${i + 1}`;
    SKILL_TREE[id] = {
      id, category: catId, rank: i + 1, tier: i + 1,
      cost: TALENT_COSTS[i] || 1,
      requires: i > 0 ? `${catId}_${i}` : null,
      name: `${cat.name} ${['I', 'II', 'III'][i]}`,
      icon: cat.icon, color: cat.color,
      desc: rank.desc,
      effect: rank.effect,
    };
  });
}

function getSkill(id) { return SKILL_TREE[id] || null; }

// Can the player buy this talent right now?
function canUnlockSkill(player, id) {
  const s = SKILL_TREE[id];
  if (!s) return { ok: false, why: 'Unknown talent' };
  if (player.unlockedSkills.includes(id)) return { ok: false, why: 'Already learned' };
  if (s.requires && !player.unlockedSkills.includes(s.requires))
    return { ok: false, why: 'Requires ' + SKILL_TREE[s.requires].name };
  if ((player.skillPoints || 0) < s.cost) return { ok: false, why: 'Not enough talent points' };
  return { ok: true };
}

// Merge every unlocked talent's effect object into one modifier bag.
function collectSkillEffects(unlocked) {
  const out = {};
  for (const id of unlocked || []) {
    const s = SKILL_TREE[id];
    if (!s || !s.effect) continue;
    for (const [k, v] of Object.entries(s.effect)) {
      if (k.endsWith('Mult')) out[k] = (out[k] ?? 1) * v;
      else out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}
