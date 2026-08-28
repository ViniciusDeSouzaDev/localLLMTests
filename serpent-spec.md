# Serpent (Labyrinth Passage) — Spec

New roguelike map node: a sequence of axe pipes whose gap centers form a connected
zigzag passage (like the letter "N"), mixing smooth curves and sharp zigzags.
Surviving the whole sequence grants a **guaranteed legendary** item.

## 1. Identity

- Map node type: `serpent` (distinct from the existing `labyrinth` node, which stays as-is)
- Name: `SERPENT` (variants in a pool, see §3)
- Icon: 🐍
- Node desc (EN): `'Serpent — zigzag axe passage, guaranteed LEGENDARY'`
- Node desc (PT): `'Serpente — passagem de machado em zigue-zague, LEGENDÁRIO garantido'`
- Help hint (ui.js `buildHelp`): `Serpent — pipes form a zigzag passage; axe damage (3x), but a legendary awaits`

## 2. Map generation (roguelike.js `genMap`)

- In the special-node roll (`cfg.widths[r] >= 2 && roll >= 0.85`), pick among available specials:
  - path 1: `elite`
  - path >= 2: `labyrinth` or `serpent` (50/50)
- Serpent only in rows after the first boss row (`r > cfg.bossRows[0]`); otherwise fall back to `elite`.
- `n.def` comes from a `SERPENTS` pool (roguelike.js, next to `LABYRINTHS`), cycled like the other pools:
  ```
  SERPENTS = [
    { name:'SERPENT',     passes:7,  colors:[60,40,80, 40,25,55, 130,90,170], eye:'#b080ff' },
    { name:'VIPER',       passes:9,  colors:[40,70,60, 25,45,40, 100,160,140], eye:'#70ff90' },
    { name:'MEDUSA',      passes:11, colors:[80,60,30, 55,40,20, 170,140,80],  eye:'#ffd060' },
  ]
  ```
  `passes` = total pipes in the sequence (drives the boss HP bar, which already works via `run.boss.passes`).

## 3. Node entry (roguelike.js `clickNode`)

```
else if(type === 'serpent'){
  const d = map.rows[r][i].def;
  run.boss = { passes:0, max:d.passes, final:false, serpent:true, phaseIdx:0, def:d };
  startStage();
}
```
Reuses the boss framework (HP bar, pass counting, defeat flow) — no new state machine.

## 4. Path generation (game.js, new `genSerpentPath(n)`)

Generated once when the boss starts (and regenerated on phoenix rebirth, §7).
Returns an array of `n` waypoints (gap centers, top→bottom order).

Constraints (fairness — "unfair but fun" is the failure mode):

- `minY = 100`, `maxY = GROUND_Y - 100`; all waypoints inside `[minY, maxY]`.
- Max step between consecutive waypoints: `maxStep = 210` px.
  (Pipes spawn ~280px apart; at `pipeSpeed()` ≈ 180–220 px/s that's ~1.3s between pipes,
  and the bird can move ~400px vertically in that time via flap `vy=-400` / fall cap 700.
  210px keeps every step comfortably reachable.)
- Direction alternates (up/down/up...), with a 25% chance a segment is a "double"
  (two consecutive same-direction steps, each ≤ 140px) to create the sharp N shape.
- Segment shapes:
  - **curve** (60%): the step is split across 2–3 pipes following a sine ease
    (waypoints at `yA + (yB-yA) * (0.5 - 0.5*cos(k*π))`, k = 0.5, 1.0...) → smooth S-curve.
  - **sharp** (40%): single big step (≤ maxStep) → the N zigzag.
- First waypoint: random in `[minY + 60, maxY - 60]` (not hugging a wall at spawn).
- Last waypoint: any valid y (sequence ends, normal pipes resume).

Pipe objects pushed to `pipes` (game.js spawn section, boss branch):
```
{ x:W+40, gapY:waypoint, gap:pipeGap()+30, baseGap:pipeGap()+30,
  passed:false, boss:true, axe:true, serpent:true }
```
- `axe:true` → existing axe visuals (render.js `p.axe`) and 3x damage (`dmg = p.axe ? 3 : ...`, game.js:737).
- `gap = pipeGap() + 30` → generous gap to compensate for 3x damage.
- Spawn one at a time with the existing 280px spacing (no extra spacing; the passage must read as connected).
- Magnet upgrade must NOT drift serpent pipes (skip `serpent` in the magnet loop) — the path is the mechanic.

## 5. Rendering (render.js)

- Pipes: reuse existing `p.axe` drawing — no new pipe art.
- Passage guide (fairness aid): while a serpent boss is active, draw a faint dashed line
  through the gap centers of all on-screen `serpent` pipes (alpha ≈ 0.25, 2px, boss eye color).
  Draw before pipes, after background.
- Boss HP bar: already renders from `run.boss` (render.js:265) — shows name + pass progress for free.

## 6. Defeat / reward (game.js, boss-defeat block ~line 588)

Add branch before `isElite || isLaby`:
```
else if(isSerpent){
  const pool = LEGENDS.filter(l => !run.legends.includes(l.id));
  if(pool.length){
    const l = pool[Math.floor(Math.random()*pool.length)];
    run.legends.push(l.id);
    showReveal(l.icon, legendInfo(l.id).name, legendInfo(l.id).desc, true);
    AudioFX.legendary();
  } else {
    run.gold += 50;
    showReveal('🪙', '+50 GOLD', '', false);
    AudioFX.reveal();
  }
  stageClearT = 1.5; pipes = [];
  popups.push({ x:BIRD_X, y:bird.y-50, txt:def.name + ' DEFEATED!', life:1.5, max:1.5 });
  refreshRlHud();
}
```
- Guaranteed legendary (random from unowned `LEGENDS`); fallback +50 gold when all owned.
- No gold on top of the legendary (it's already the big reward).

## 7. Edge cases

- **Phoenix rebirth** (game.js:406-415): existing code filters pipes around the bird.
  For serpent bosses, regenerate the remaining waypoints from `run.boss.passes`
  so the path continues coherently instead of resuming mid-sequence.
- **Invulnerability/knockback** on hit: unchanged (existing pipe-hit code, 3x dmg via `p.axe`).
- **Death**: normal death flow; run stats unchanged.
- **Classic mode**: untouched — all logic gated on `run.boss.serpent` / `mode==='rl'`.
- **i18n**: `NODE_NAMES` (en/pt) in roguelike.js, `NODE_ICONS`, help hint in ui.js.
  `SERPENTS` names are proper nouns (no translation); descs via NODE_NAMES only.

## 8. Files touched

| File | Change |
|---|---|
| `js/roguelike.js` | `SERPENTS` pool, `genMap` roll, `clickNode` branch, `NODE_NAMES`/`NODE_ICONS` |
| `js/game.js` | `genSerpentPath()`, boss spawn branch, magnet exclusion, defeat branch, rebirth regen |
| `js/render.js` | passage guide line |
| `js/ui.js` | help hint line |

## 9. Verification

- Path 1 map: no serpent nodes appear.
- Path 2/3 map: serpent nodes appear only after first boss row, icon 🐍, correct name.
- Clicking a serpent node: HP bar shows name, sequence of axe pipes forms a connected zigzag;
  every step visually reachable (max 210px between centers); guide line visible.
- Hit a serpent pipe: 3x damage, knockback, invuln blink.
- Survive all `passes`: legendary reveal (or +50g if all owned), back to map.
- Phoenix during serpent: path regenerates cleanly, no duplicate/missing pipes.
- Classic mode: byte-identical behavior (no serpent references reachable).
