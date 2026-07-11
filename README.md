# Dead Zone: Reclamation  ·  v0.3 (True 3D)

A browser-based zombie-survival prototype inspired by Dead Frontier. Vanilla
JavaScript, no build step. Now renders in **real 3D via Three.js** (vendored
locally at `js/vendor/three.min.js`, so it still runs offline): a perspective
camera, 3D humanoid character/enemy/boss meshes, dynamic lighting and shadows.
All game logic stays cartesian (x, y ground plane, height up) and is mapped to
Three.js space — a thin 2D `#fx` canvas on top draws floating combat text,
world-space labels, the interaction prompt and the aim reticle.

> Earlier revisions rendered on a 2D canvas (v0.1 top-down, v0.2 isometric 2.5D).
> The `js/core/Iso.js` projection helpers remain in the tree but are no longer the
> renderer.

## Run it

1. **Double-click `index.html`** — runs directly from `file://` (ordered classic
   `<script>` tags, not ES modules, so there's no CORS issue).
2. **Serve it** (recommended while developing — the dev server disables caching so
   edits always show up on reload):
   ```
   python dev_server.py
   ```
   then open <http://localhost:8137>. (Plain `python -m http.server 8137` also works
   but the browser may serve stale JS from cache.)

On launch you pick a **class**, then progress auto-saves to LocalStorage and reloads
via the **Continue** button next time.

## Controls

| Input | Action |
|-------|--------|
| `WASD` / Arrows | Move |
| `Shift` | Sprint (drains stamina) |
| Mouse | Aim |
| Left-click | Attack (shoot / melee swing) |
| `1` / `2` / `Q` | Melee / Pistol / toggle weapon |
| `R` | Reload pistol |
| `E` | Interact — loot container, **enter building**, exit, trader, storage, heal |
| `F` | Quick-heal from inventory |
| `I` | Inventory  ·  `C` | Character  ·  `Esc` | Close window |
| `M` | Manual save |

## Core loop

Enter world → explore Ravenside → kill zombies → loot containers → return to the
Safe Zone → sell loot to the Trader → buy gear / spend stat points → repeat.

## Architecture

```
index.html          # WebGL canvas + #fx overlay + DOM UI, ordered script loads
styles.css          # Dark survival-horror UI + class picker + loading screen
dev_server.py       # Threaded no-cache static server for development
assets/             # Placeholder drop-in point
js/
  vendor/three.min.js  # Three.js r128 (UMD, global THREE) — vendored for offline
  data/             # Pure data tables — tune the game here
    config.js         world size, physics, spawn rates, iso projection, progression
    items.js          item defs + rarity
    weapons.js        weapon stats (pistol, melee)
    loot-tables.js    container → drop tables (car/crate/cabinet/locker/medbox/...)
    prices.js         trader buy/sell multipliers + stock
    classes.js        the 5 player classes + their modifiers/kits
    enemies.js        the bestiary (walker/leaper/bloat/brute/wraith/reaper/titan)
  core/
    Utils.js          math / RNG / geometry
    Iso.js            isometric projection + 2.5D primitives + RenderList (depth sort)
    Input.js          keyboard + mouse, inverse-iso mouse pick
    Camera.js         iso follow (writes screen offset into the shared View)
    Collision.js      circle-vs-rect resolve, swept ray tests
    ObjectManager.js  SceneObjects (spawn/nearest/serialize) + LootContainer prop
    EntityManager.js  zombies, bullets, enemy projectiles, particles, spawn cadence
    SaveSystem.js     LocalStorage serialize/load
    Renderer3D.js     Three.js scene/camera/lights; builds + syncs 3D meshes
  render/Models.js    3D mesh builders (humanoids, boss, tracers, bile)
  world/
    World.js          overworld: wide city, 10 enterable buildings, outpost safe zone
    interior.js       generated building interior instances (loot + infected + exit)
  entities/
    Entity.js         base circular body
    Bullet.js         swept player projectile (+ EnemyProjectile for the Wraith)
    Zombie.js         type-driven FSM: chase/attack/leap/ranged/explode/knockback
    Player.js         movement, stamina, combat, stats, XP, class modifiers
  systems/
    Inventory.js      grid, stacking, weight, drag/drop model
    LootSystem.js     table rolls (Survival + class loot bonus boost quantity)
    Trader.js         buy/sell
    Progression.js    XP curve + award values
  ui/UI.js            HUD bars, inventory/trader/character/storage windows, tooltips
  Game.js             loop, scene switching (overworld ↔ interiors), combat wiring
  main.js             boot + class picker
```

## v0.3 highlights

- **True 3D (Three.js):** `js/core/Renderer3D.js` builds/updates the 3D scene from
  live game state; `js/render/Models.js` builds the humanoid meshes (player, each
  infected type, and a bulked-up multi-part **Titan** boss with horns + glowing
  eyes). Perspective follow-camera, hemisphere + shadow-casting sun, distance fog.
- **Rare bosses:** Titans are excluded from the normal spawn pool and appear only
  ~2% of eligible spawns in the deeper districts (tier ≥ 3), capped at one alive.
- **Cross-map guns:** rounds travel ~6000 units (fast + long-lived), so you can
  engage clear across the district.
- **Scarcer loot:** far fewer street containers on a much larger map, fewer per
  interior, and fewer picks per container — the real hauls are deep inside buildings.
- **Coherent, spread-out map:** a 6400×4800 city on a real avenue grid, one
  landmark per block, buildings spaced far apart; difficulty rises toward the NE.
- **Loading instances:** pressing `E` at a door shows a loading screen while the
  building interior instance is generated, then drops you inside.

## Feature coverage

- **3D engine:** cartesian logic mapped to Three.js; meshes are created/synced/
  removed each frame to match entities; a 2D `#fx` overlay handles text + reticle.
- **World:** a wide multi-district city (difficulty rises with distance from the
  outpost) with streets, a walled outpost Safe Zone, and **10 enterable buildings**.
- **Building instances:** entering a door loads a generated interior scene (its own
  walls, loot mapped to the building type — e.g. hospital→medbox, bank→register —
  and infected scaled to the district tier) with an EXIT pad back to the street.
- **Classes:** Soldier / Medic / Engineer / Scout / Scavenger, each with distinct
  starting stats, a starter kit, and real multiplicative modifiers (damage, healing,
  loot, carry weight, move speed, crit, stealth, regen).
- **Bestiary:** Walker, Leaper (pounce), Bloat (toxic death burst), Brute (knockback
  tank), Wraith (ranged bile), Reaper (fast pack hunter), and the **Titan** boss —
  one type-driven `Zombie` class with behavior flags; tiers gate where they appear.
- **Player:** WASD, sprint/stamina, health, currency, XP, levels, 4 RPG stats with
  derived effects, plus class modifiers layered on top.
- **Combat:** pistol (ammo, magazine, reload, spread) and melee (arc swing);
  centre-mass hits are headshots (type-specific multiplier); crit chance per class.
- **Loot:** 9 container types with randomized weighted drop tables; Survival stat +
  class loot bonus improve quantities.
- **Inventory:** grid with stacking, weight system, drag-to-reorder, click-to-use
  /equip, persisted between sessions; separate unlimited Safe-Zone stash.
- **Safe Zone:** no zombies, free healing station, Trader, and Storage.
- **Trading:** buy from configurable stock, sell items, "sell all materials".
- **UI:** health/stamina/XP bars, inventory/trader/character/storage windows,
  tooltips, floating combat text, low-health vignette, start & death screens.

## Extending

- **Balance:** edit `js/data/*.js` — nothing in the logic hard-codes numbers.
- **Art:** all visuals are procedural; see `assets/README.txt` for the recommended
  `Assets.js` loader hook to swap in sprite sheets.
- **New enemy types:** subclass `Zombie` (override the FSM `update`) and spawn via
  `EntityManager`.
```
