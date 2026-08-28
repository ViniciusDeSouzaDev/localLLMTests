# Spec: Path 3 — "Punishment" (cosmic final path)

Goal: add a third, final roguelike path with cosmic themes, new bosses/relics, hardest difficulty, and a unique skin reward.

## Decisions (agreed)
- Name: **Punishment**
- Themes (ordered, cycling per stage): `eclipse` → `asteroid` → `nebula` → `void` → `singularity`
- New relics (RELICS3)
- New skin unlocked by clearing Path 3
- Bosses: 4 + final (like Path 2)
- Map: 16 rows, bossRows [3,7,11] + final row 16
- Difficulty: gap 90, speed +18 over base (Path 2 is 95/+14)

## 1. Themes (js/game.js THEMES + setTheme, js/render.js)

### eclipse
- Sky: dark purple day → near-black night; dim dying sun (small, orange rim)
- Silhouettes: dark mountain ridges (kind 'ridge')
- Particles: faint orange corona motes drifting

### asteroid
- Sky: deep blue-black, dense star field
- Silhouettes: floating rock chunks (kind 'rock', drifting slowly)
- Particles: small drifting pebbles

### nebula
- Sky: purple-pink-teal gradient, bright stars
- Silhouettes: none (or faint gas blobs)
- Particles: colorful star sparkles (multi-hue)

### void
- Sky: black with purple nebula wisps
- Silhouettes: jagged shards orbiting a black hole center (kind 'shard')
- Particles: purple shards spiraling inward

### singularity
- Sky: white-hot core glow at center, black edges (radial gradient)
- Silhouettes: warped ring (kind 'ring')
- Particles: stars streaking toward center

Note: `void` theme is already reserved from the Path 2 work — implement it here.

## 2. Path config (js/roguelike.js)

- `PATHS[3] = { rows:16, widths:[...], bossRows:[3,7,11] }` (widths pattern TBD, similar density to Path 2)
- `BOSSES3`: 4 entries + final, cosmic names, more passes/phases than Path 2:
  - Row 3: **LUNAR** (12 passes, 2 phases)
  - Row 7: **ASTRAEL** (13 passes, 3 phases)
  - Row 11: **NEBULAWN** (14 passes, 3 phases)
  - Row 16 final: **THE ECLIPSE** (20 passes, 4 phases, fog)
- `RELICS3` (4 new):
  - `corona` ☀️ Corona — +2 gold per pipe
  - `star` ⭐ Star Fragment — +1 max HP
  - `comet` ☄️ Comet — 30% chance to negate pipe damage
  - `singularity` 🌀 Singularity — fever every 12 pipes
- `relicPool()`: path 3 → RELICS3
- `genMap(3)`: boss pool BOSSES3, labyrinth nodes ok
- `pathCfg()`/difficulty: gap 90, speed +18 (game.js:213-219)
- `PATH_THEMES[3]` = the 5 cosmic themes
- `THEME_TRACKS` entries for the 5 new themes

## 3. Music (js/roguelike.js AudioFX)

5 new tracks (one per theme): `eclipse`, `asteroid`, `nebula`, `void`, `singularity`
- Style: creepy/drone like `ashes` (square, low volume, slow, low bass)
- `PATH3_POOL` = those 5
- game.js music switch: path 3 → PATH3_POOL

## 4. UI / unlock (js/ui.js, index.html)

- Victory screen on Path 2 clear: "PUNISHMENT UNLOCKED" + continue button → `run.path = 3; map = genMap(3)`
- Path 3 victory: "TRUE VICTORY" screen, no continue
- `save.punishmentCleared` flag (persist)
- i18n strings EN + PT for new screens

## 5. Skin reward (js/core.js)

- New skin `alien`: alien bird — green body (#57e83b), dark belly (#d9ffc4), alien wing (#2e9e1e), glowing trail, `alien:true` flag
- Power: `nova` — 6 HP + shield 2 + magnet 2 + starts with Midas x3 (+3 pts/pipe)
- Unlock: NOT by points — `save.punishmentCleared` (shown in skins list, selectable only after Path 3 clear)
- SKIN_HP: eclipse: 6

## 6. Axe pipe (Path 3 only)

- New pipe type `axe`: same gap/hitbox as normal pipes, rendered as an axe (handle + metal head)
- Damage: 3 HP (shield still blocks the hit fully — shield absorbs the whole hit)
- Spawns only in Path 3, from stage 2 onward, ~15% chance per pipe
- Visual: distinct color (e.g. dark steel + red head) so players recognize it

## 7. Out of scope
- Nothing — this is the final path.

## 8. Verification
- Clear Path 2 (or console: `run.path=3; map=genMap(3); showMap()`) → Path 3 playable
- Stages cycle eclipse→asteroid→nebula→void→singularity with matching music
- Bosses/relics from Path 3 pools
- Victory unlocks skin; skin persists and is selectable
- Classic + Path 1 + Path 2 unchanged
