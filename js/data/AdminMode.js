/* Admin Mode: Debug/cheat console
 * Activated with Ctrl+Shift+A
 * Provides commands for testing and development
 */

class AdminMode {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.visible = false;
    this.commandHistory = [];
    this.historyIndex = 0;
    this.setupKeybinds();
  }

  setupKeybinds() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.toggle();
      }
      if (this.visible && e.key === 'Enter') {
        const input = document.getElementById('admin-input');
        if (input && document.activeElement === input) {
          this.execute(input.value);
          input.value = '';
        }
      }
      if (this.visible && e.key === 'ArrowUp') {
        e.preventDefault();
        this.historyIndex = Math.max(0, this.historyIndex - 1);
        const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        const input = document.getElementById('admin-input');
        if (input) input.value = cmd || '';
      }
      if (this.visible && e.key === 'ArrowDown') {
        e.preventDefault();
        this.historyIndex = Math.min(this.commandHistory.length - 1, this.historyIndex + 1);
        const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        const input = document.getElementById('admin-input');
        if (input) input.value = cmd || '';
      }
    });
  }

  toggle() {
    this.visible = !this.visible;
    this.enabled = this.visible;
    this.createUI();
  }

  createUI() {
    if (!this.visible) {
      const panel = document.getElementById('admin-panel');
      if (panel) panel.remove();
      return;
    }

    let panel = document.getElementById('admin-panel');
    if (panel) return; // Already exists

    panel = document.createElement('div');
    panel.id = 'admin-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 200px;
      background: rgba(0,0,0,0.9);
      border-top: 2px solid #0f0;
      color: #0f0;
      font-family: monospace;
      z-index: 10000;
      display: flex;
      flex-direction: column;
    `;

    const output = document.createElement('div');
    output.id = 'admin-output';
    output.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      font-size: 12px;
      border-bottom: 1px solid #0f0;
    `;

    const input = document.createElement('input');
    input.id = 'admin-input';
    input.type = 'text';
    input.placeholder = '> ';
    input.style.cssText = `
      background: rgba(0,0,0,0.5);
      border: none;
      color: #0f0;
      font-family: monospace;
      padding: 8px;
      font-size: 14px;
      outline: none;
    `;

    panel.appendChild(output);
    panel.appendChild(input);
    document.body.appendChild(panel);

    input.focus();
    this.log('Admin Mode Enabled - Type "help" for commands');
  }

  execute(command) {
    const cmd = command.trim().toLowerCase();
    if (!cmd) return;

    this.commandHistory.push(cmd);
    this.historyIndex = 0;
    this.log(`> ${cmd}`);

    const [verb, ...args] = cmd.split(' ');

    switch (verb) {
      case 'help':
        this.showHelp();
        break;
      case 'godmode':
        this.godmode(args[0]);
        break;
      case 'spawn':
        this.spawnZombie(args[0], parseInt(args[1]) || 1);
        break;
      case 'spawnboss':
        this.spawnBoss(args[0]);
        break;
      case 'time':
        this.setTime(parseInt(args[0]) || 0);
        break;
      case 'give':
        this.giveItem(args[0], parseInt(args[1]) || 1);
        break;
      case 'credits':
        this.giveCredits(parseInt(args[0]) || 100);
        break;
      case 'level':
        this.setLevel(parseInt(args[0]) || 1);
        break;
      case 'xp':
        this.giveXp(parseInt(args[0]) || 100);
        break;
      case 'siege':
        this.triggerSiege();
        break;
      case 'heal':
        this.healPlayer(parseInt(args[0]) || 100);
        break;
      case 'damage':
        this.damagePlayer(parseInt(args[0]) || 10);
        break;
      case 'weapon':
        this.giveWeapon(args[0]);
        break;
      case 'armor':
        this.giveArmor(args[0]);
        break;
      case 'mission':
        this.setMission(args[0]);
        break;
      case 'speed':
        this.setGameSpeed(parseFloat(args[0]) || 1);
        break;
      case 'kill':
        this.killAllZombies();
        break;
      case 'clear':
        this.clearOutput();
        break;
      case 'stats':
        this.showStats();
        break;
      default:
        this.log(`Unknown command: ${verb}. Type "help" for list.`);
    }
  }

  log(msg) {
    const output = document.getElementById('admin-output');
    if (output) {
      const line = document.createElement('div');
      line.textContent = msg;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }
  }

  showHelp() {
    this.log('=== Admin Commands ===');
    this.log('godmode [on/off] - Toggle invulnerability');
    this.log('spawn [type] [count] - Spawn zombies (walker, runner, bloat, etc)');
    this.log('spawnboss [type] - Spawn a boss (titan, etc)');
    this.log('time [hour] - Set time of day (0-24)');
    this.log('give [itemId] [qty] - Add item to inventory');
    this.log('credits [amount] - Add credits');
    this.log('level [num] - Set player level');
    this.log('xp [amount] - Add XP');
    this.log('heal [amount] - Heal player');
    this.log('damage [amount] - Damage player');
    this.log('weapon [weaponId] - Give weapon');
    this.log('armor [armorId] - Give armor piece');
    this.log('mission [missionId] - Set active mission');
    this.log('siege - Trigger outpost attack');
    this.log('speed [multiplier] - Set game speed (1 = normal)');
    this.log('kill - Kill all zombies');
    this.log('stats - Show player stats');
    this.log('clear - Clear output');
  }

  godmode(toggle) {
    if (toggle === 'on' || toggle === '1') {
      this.game.player.godMode = true;
      this.log('Godmode ON');
    } else if (toggle === 'off' || toggle === '0') {
      this.game.player.godMode = false;
      this.log('Godmode OFF');
    } else {
      this.game.player.godMode = !this.game.player.godMode;
      this.log(`Godmode ${this.game.player.godMode ? 'ON' : 'OFF'}`);
    }
  }

  spawnZombie(type, count) {
    const typeId = type || 'walker';
    for (let i = 0; i < count; i++) {
      const p = this.game.scene.randomStreetPoint(
        this.game.player.x, this.game.player.y, 200
      );
      this.game.entities.spawnZombieAt(p.x, p.y, typeId);
    }
    this.log(`Spawned ${count} ${typeId}(s)`);
  }

  spawnBoss(type) {
    const typeId = type || 'titan';
    const p = this.game.scene.randomStreetPoint(
      this.game.player.x, this.game.player.y, 300
    );
    this.game.entities.spawnZombieAt(p.x, p.y, typeId);
    this.log(`Spawned boss: ${typeId}`);
  }

  setTime(hour) {
    if (this.game.setTimeOfDay) {
      this.game.setTimeOfDay(hour);
      this.log(`Time set to ${hour}:00`);
    }
  }

  giveItem(itemId, qty) {
    if (this.game.inventory && this.game.inventory.add) {
      this.game.inventory.add(itemId, qty);
      const item = getItem(itemId);
      this.log(`Added ${qty}x ${item ? item.name : itemId}`);
    }
  }

  giveCredits(amount) {
    this.game.player.credits += amount;
    this.log(`+${amount} credits (now: ${this.game.player.credits})`);
  }

  setLevel(level) {
    if (this.game.player.level !== level) {
      this.game.player.level = level;
      this.log(`Level set to ${level}`);
    }
  }

  giveXp(amount) {
    if (this.game.player.addXp) {
      this.game.player.addXp(amount);
      this.log(`+${amount} XP`);
    }
  }

  triggerSiege() {
    if (this.game.triggerSiege) {
      this.game.triggerSiege();
      this.log('Siege triggered!');
    }
  }

  healPlayer(amount) {
    this.game.player.heal(amount);
    this.log(`Healed ${amount} HP`);
  }

  damagePlayer(amount) {
    this.game.player.takeDamage(amount, null);
    this.log(`Took ${amount} damage`);
  }

  giveWeapon(weaponId) {
    if (!weaponId) {
      this.log('Usage: weapon [weaponId]');
      return;
    }
    if (this.game.player.equipWeapon) {
      this.game.player.equipWeapon(weaponId);
      const w = getWeapon(weaponId);
      this.log(`Equipped ${w ? w.name : weaponId}`);
    }
  }

  giveArmor(armorId) {
    if (!armorId) {
      this.log('Usage: armor [armorId]');
      return;
    }
    const armor = new ArmorInstance(armorId);
    if (this.game.player.equipArmor) {
      this.game.player.equipArmor(armor);
      this.log(`Equipped ${armor.def.name}`);
    }
  }

  setMission(missionId) {
    if (!missionId) {
      this.log('Usage: mission [missionId]');
      return;
    }
    const m = getMission(missionId);
    if (!m) {
      this.log(`Mission not found: ${missionId}`);
      return;
    }
    if (this.game.setMission) {
      this.game.setMission(missionId);
      this.log(`Mission: ${m.title}`);
    }
  }

  setGameSpeed(multiplier) {
    if (this.game.timeScale !== undefined) {
      this.game.timeScale = multiplier;
      this.log(`Game speed: ${multiplier}x`);
    }
  }

  killAllZombies() {
    let count = 0;
    for (const z of this.game.entities.zombies) {
      if (z.alive) {
        z.alive = false;
        z.dead = true;
        count++;
      }
    }
    this.log(`Killed ${count} zombies`);
  }

  clearOutput() {
    const output = document.getElementById('admin-output');
    if (output) output.innerHTML = '';
  }

  showStats() {
    const p = this.game.player;
    this.log('=== Player Stats ===');
    this.log(`Level: ${p.level} (XP: ${p.xp}/${p.nextLevelXp})`);
    this.log(`Health: ${p.health}/${p.maxHealth}`);
    this.log(`Stamina: ${p.stamina}/${p.maxStamina}`);
    this.log(`Credits: ${p.credits}`);
    this.log(`Kills: ${this.game.stats.kills}`);
    this.log(`Zombies alive: ${this.game.entities.liveZombieCount()}`);
    this.log(`Position: ${Math.round(p.x)}, ${Math.round(p.y)}`);
  }
}
