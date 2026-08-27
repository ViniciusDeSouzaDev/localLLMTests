# Boss Visuals Spec

Goal: make bosses visually distinct and dramatic — animated faces, per-boss aura particles, and entrance/defeat animations.

## Context (existing code)

- Bosses render as normal pipes via `drawPipe` in `js/render.js` (boss branch: colors at render.js:207-211, eye dots at render.js:256-264).
- Gap edges: `topH = p.gapY - p.gap/2`, `botY = p.gapY + p.gap/2`. Pipe: x = `p.x`, width 70, cap height 26.
- Boss defs in `js/roguelike.js:221-249`: `{ name, passes, relic, colors:[body,dark,light], eye, phases }`.
- Boss state: `run.boss = { passes, max, final, elite, labyrinth, def, labyOn, labyT }`.
- Entrance hook: `startStage()` in roguelike.js:485-488 (already does shake/flash/popup).
- Defeat hook: game.js:460-498 — `run.boss = null` at line 464; `pipes = []` clears the boss pipe instantly for elite/laby.
- Global anim time: `t` (used as `Math.sin(t*...)` in render.js). Bird: `bird.y`, `BIRD_X`.
- Particle precedent: popups array pattern (game.js) — free-floating particles should follow it.

## Task 1 — Animated face on the gap ✅ DONE

Replace the two static eye dots (render.js:256-264) with a face drawn on the gap edges:

- **Eyes**: two eyes per edge (top edge looks down, bottom edge looks up), pupils offset toward `bird.y` (clamped), blink every ~3s (scale Y to 0.1 for 120ms).
- **Mouth**: small arc/line between eyes; opens (taller) while the gap is moving (compare `p.gapY` vs previous frame, or use `run.boss.labyT`/phase speed), closes otherwise.
- **Roar flash**: on phase change (track `pidx` from game.js:351-352 logic — store `run.boss.phaseIdx` already exists; compare against recomputed index), flash face white + `shake = 10` for ~0.3s.
- **Tier extras**: `final` bosses get a third eye on the cap; `elite` gets angry brow lines; `labyrinth` gets a mask (dark band over eyes, only eye color glows).
- Keep the existing `shadowBlur` glow using `def.eye`.

Verify: play a boss fight, face tracks bird, blinks, roars on phase change.

## Task 2 — Per-boss aura particles ✅ DONE

Emit particles from the gap edges, keyed by boss name (fallback: derive from `def.colors`):

- EMBERLORD / GAPLORD III: rising embers (orange, fade out).
- STORMFEATHER: small lightning arcs flickering at the edges.
- TIDEWRAITH / GAPLORD IV: rising bubbles.
- VOIDLORD / NULLKNIGHT / THE ENDLESS: expanding dark rings from the gap center.
- OMEGA GAPLORD / GAPLORD I: gold sparkles.
- Default: soft glow pulse (cheap fallback so every boss gets something).
- Particle pool: cap ~40 particles, reuse array, no allocation per frame. Add to existing particle/popup rendering pass.

Verify: each named boss emits its aura; no perf hit (test with 40+ particles).

## Task 3 — Entrance & death animations ✅ DONE

- **Entrance** (roguelike.js:485-488): add a 1.5s "boss intro" — dark vignette ramps in (reuse `nf` vignette from render.js:195-198), face eyes glow up from 0, name banner already exists (keep popup).
- **Death** (game.js:460-498): instead of `pipes = []` clearing instantly, spawn 20-30 shard particles from the boss pipe (use `def.colors`), let them fall/fade over ~1s, then clear. For `final` boss: bigger burst + `flash = 1`.
- Store boss pipe reference before nulling (`p` is in scope at game.js:457).

Verify: defeat an elite — shards fly, no instant pop; final boss victory still triggers `showVictory()`.

## Order

1 → 2 → 3 (each independently verifiable; 1 changes the eye code that 3's intro reuses).
