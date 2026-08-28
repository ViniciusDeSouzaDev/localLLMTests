# Spec: Thematic Paths — Backgrounds & Music

Goal: give each roguelike path its own visual identity (ordered background sequence per stage) and tie music to the theme. Classic mode keeps random rotation.

## 1. Path → theme mapping

Themes are set in `startStage()` (js/roguelike.js:561), replacing `setTheme(randomTheme())`.
Theme = path's list indexed by `run.stage` (cycle if stages exceed list length).

### Path 1 — "The Path" (bright world tour, existing themes)
| Stage | Theme |
|---|---|
| 1 | forest |
| 2 | city |
| 3 | desert |
| 4 | snow |
| 5+ | ocean (then cycle: forest, city, ...) |

### Path 2 — "Ascension" (dark, corrupted — 5 NEW themes)
| Stage | Theme |
|---|---|
| 1 | inferno |
| 2 | storm |
| 3 | abyss |
| 4 | necropolis |
| 5+ | ashes (then cycle: inferno, storm, ...) |

### Classic mode
Unchanged: random theme every 10 pipes (js/game.js:526-528).

## 2. New backgrounds (js/game.js THEMES + setTheme, js/render.js)

Each new theme needs: skyTop/skyBot day-night gradients, ground colors, silhouettes, particles — following existing patterns (game.js:27-74, render.js:92-135, 470-500).

### inferno
- Sky: dark red-orange day → near-black night
- Ground: obsidian/lava (glowing cracks)
- Silhouettes: jagged obsidian spikes
- Particles: rising embers

### storm
- Sky: dark gray-blue, rain
- Ground: dark wet earth
- Silhouettes: torn clouds / bare trees
- Particles: falling rain streaks + occasional lightning flash (screen flash)

### abyss
- Sky: near-black teal (day/night barely differ)
- Ground: dark seabed
- Silhouettes: shipwreck masts / coral
- Particles: bioluminescent dots drifting up

### necropolis
- Sky: sickly green-gray, heavy fog
- Ground: dark soil
- Silhouettes: tombstones, dead trees
- Particles: green ghost glow motes

### ashes
- Sky: gray-black, faint red glow at horizon
- Ground: gray ash
- Silhouettes: ruined tower/city ruins
- Particles: falling ash

Note: `Void` theme (nebula/black hole) is RESERVED for future Path 3 "Eclipse" — do not use in Path 2.

## 3. Music (js/roguelike.js AudioFX)

Tie music pool to path (game.js:637-643 music switch + startStage):

- **Path 1 pool** (existing tracks): `forest`, `city`, `sunset`, `dream`, `ocean`
- **Path 2 pool** (dark): `inferno`, `storm` (existing) + 3 new tracks:
  - `abyss` — slow (~80 bpm), sine, sparse, low bass
  - `necropolis` — minor, eerie, slow hats (hat:8), triangle
  - `ashes` — low drone, heavy square bass, slow (~90 bpm)
- **Classic mode**: unchanged (full POOL, FEVER_POOL during fever)

New tracks added to `TRACKS` (roguelike.js:646-704) but NOT to `POOL` (keep classic pool as is) — or add to POOL if desired (decision: keep out of POOL).

## 4. Out of scope (Path 3, later)
- Path 3 "Eclipse" unlock (clear Path 2), new bosses, cosmic themes (void etc.) — designed later.

## 5. Verification
- Play Path 1: stages show forest→city→desert→snow→ocean in order, matching bright music.
- Play Path 2: stages show inferno→storm→abyss→necropolis→ashes, dark music.
- Classic: random themes + random music unchanged.
- Day/night cycle still works on all new themes.
