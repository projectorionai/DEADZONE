const ABILITIES = {
  soldier: {
    id: 'adrenaline',
    name: 'Adrenaline Rush',
    description: 'Surge with adrenaline: +50% fire rate, +30% movement speed for 6 seconds.',
    cooldown: 15,
    duration: 6,
    effect: { fireRateMult: 1.5, speedMult: 1.3 },
  },
  medic: {
    id: 'heal_burst',
    name: 'Heal Burst',
    description: 'Emit healing pulse: restore 40 HP and gain +20% damage resistance for 5 seconds.',
    cooldown: 12,
    duration: 5,
    effect: { hpRestore: 40, damageResist: 0.2 },
  },
  hunter: {
    id: 'mark_target',
    name: 'Tactical Mark',
    description: 'Mark the nearest zombie: you deal +35% damage to marked target for 8 seconds.',
    cooldown: 14,
    duration: 8,
    effect: { damageBonus: 0.35 },
  },
  engineer: {
    id: 'deploy_turret',
    name: 'Deploy Turret',
    description: 'Deploy an automated turret that guns down nearby infected for 12 seconds.',
    cooldown: 22,
    duration: 12,
    effect: { turret: true },
  },
  scout: {
    id: 'combat_roll',
    name: 'Combat Roll',
    description: 'Roll a short distance in your facing direction, briefly dodging all damage.',
    cooldown: 8,
    duration: 0,
    effect: { roll: true },
  },
  scavenger: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Catch your breath: restore 30 HP and gain +25% movement speed for 6 seconds.',
    cooldown: 16,
    duration: 6,
    effect: { hpRestore: 30, speedMult: 1.25 },
  },
};

function getAbility(classId) {
  return ABILITIES[classId] || null;
}
