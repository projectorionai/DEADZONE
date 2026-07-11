Dead Zone: Reclamation — Asset Placeholders
===========================================

This prototype renders ALL visuals procedurally on the HTML5 canvas
(colored shapes + emoji glyphs), so no external image/audio files are
required to run. This folder is the drop-in point for future art.

Suggested structure when you add real assets:

  assets/
    sprites/
      player.png          32x32 or 48x48 sheet (idle/walk frames)
      zombie_walker.png   walker frames
      items.png           item icon atlas (32x32 cells)
    tiles/
      street.png          road/pavement tiles (64x64)
      building_*.png      facade tiles
    audio/
      pistol.wav  reload.wav  melee.wav  hit.wav  zombie_growl.wav
      pickup.wav  level_up.wav  ui_click.wav
    ui/
      cursor.png          custom crosshair

How art hooks in later:
  - Item glyphs come from js/data/items.js (`glyph` + `color`). Swap the
    canvas draw calls in the render() methods for drawImage() once a sprite
    atlas is loaded via an AssetLoader.
  - Recommended: add js/core/Assets.js that preloads images/audio and exposes
    Assets.img('player'), then replace ctx.fill* calls in Player/Zombie/
    ObjectManager render() methods.

Nothing here is loaded at runtime yet — the game is fully playable as-is.
