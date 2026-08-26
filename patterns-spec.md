# Spec: Boss Pattern Variety (v2)

Adds new gap patterns, global phase effects, and elite identity. All new patterns use the same declarative `phases:[{pattern, ...}]` format and plug into the if-chain at the boss update loop.

## 1. New per-pipe gap patterns

| pattern | params | behavior |
|---|---|---|
| `step` | `spd` (interval s, default 1.5), `tele` (telegraph s, default 0.4) | Gap sits still; during last `tele` s of each interval it wobbles toward a new random target, then jumps. |
| `mirror` | `rate` (default 1.0) | Anti-chase: gap eases toward the mirrored bird position (`center*2 - bird.y`), clamped to play area. |
| `shrink` | `rate` (per-second shrink, default 0.06) | Gap starts at `baseGap` and shrinks over time to min 70; resets on phase change (existing reset code). |
| `blink` | `spd` (interval s, default 1.2), `tele` (default 0.35) | Gap warps to a random position; during `tele` s before each warp the gap flashes/blinks as warning. |
| `drift` | `spd` (speed px/s, default 60) | Slow sawtooth: gap slides one direction, reverses at top/bottom walls. |

## 2. New global phase effects

| effect | params | behavior |
|---|---|---|
| `wind` (pattern) | `g` (gravity mult, e.g. 0.8 or 1.2), optional `amp`/`spd` | Phase applies gravity multiplier while active; gap uses default sine (or static if no amp). |
| `fog` (phase flag) | `fog:true` | Pipes further than ~300px from bird are drawn dimmed/hidden until close. Visual only. |

## 3. Elite identity (own patterns, no longer reusing boss ones)

- ELITE → `drift` (spd 70)
- BRUISER → `shrink` (rate 0.08)
- DART → `step` (spd 1.2, tele 0.35)
- PHANTOM → `blink` (spd 1.0, tele 0.3)

## 4. Elite phase-2 surprise

At elite boss start, 50% chance: append a short second phase (2 passes) — random from `chase` (rate 1.0) / `squeeze` (spd 2.6). Phase-change popup still fires.

## 5. Reassigned existing bosses (variety)

Path 1:
- GAPLORD II: `sine` → `mirror` (was chase)
- MIDNIGHT: `squeeze` → `step`
- FINAL BOSS: `sine` → `mirror` → `pulse`
- THE ENDLESS: `squeeze` → `hunt` → `labyrinth` + `fog:true`

Path 2:
- GAPLORD IV: `pulse` → `drift`
- TIDEWRAITH: `zigzag` → `blink`
- GAPLORD V: `sine` → `mirror` → `pulse`
- THE WARDEN: `pulse` → `labyrinth` → `mirror`
- VOIDLORD: `sine` → `wind` (g 1.2) → `labyrinth` → `chase`
- OMEGA GAPLORD: `squeeze` → `labyrinth` → `hunt` → `wind` (g 0.8) + `fog:true`

Labyrinth nodes unchanged (LABYRINTH/CRAWL/GALE keep `labyrinth`).

## 6. Verification

- `node --check` on extracted script after each step.
- Classic mode untouched (all changes gated behind `run.boss` / RL defs).
