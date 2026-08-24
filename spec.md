# Flappy Deluxe — Roguelike Mode Spec

Two modes in one game: **Classic** (existing endless mode, untouched) and **Roguelike** (new, Slay the Spire inspired).

## 1. Modes & state machine

- Menu gains a mode toggle: `CLASSIC` / `ROGUELIKE` (two buttons, persisted in `save.mode`).
- Classic keeps current states: `menu | ready | play | dead`.
- Roguelike adds states: `draft` (upgrade pick), `shop` (merchant), `stageClear` (brief interstitial).
- `state` values become: `menu | ready | play | dead | draft | shop`. (`stageClear` is a 1.2s timer inside `play`→`draft` transition, not a separate state.)
- All new logic is gated by `mode === 'rl'`. Classic code paths must remain byte-identical in behavior.

## 2. Run state (roguelike only)

```
run = {
  hp: 3, maxHp: 3,
  gold: 0,
  stage: 1,          // current stage number
  pipesInStage: 0,   // pipes passed in current stage
  upgrades: [],      // ids of picked upgrades
  relics: [],        // ids of relics earned
  invulnT: 0,        // invulnerability timer after a hit
  boss: null,        // boss state while active
}
```

- `resetRun()` called when starting an RL run. `reset()` (classic) untouched.
- Meta save: `save.rl = { bestStage: 0, bestPipes: 0 }` — updated on RL death.

## 3. HP & damage (RL only)

- Bird starts with 3 HP (hearts in HUD).
- Pipe collision: `-1 HP`, `invulnT = 2` (2s invulnerability, bird blinks), small knockback (`vy = -250`), pipe is marked `passed` so it can't re-hit.
- HP reaches 0 → death (same death screen, but shows run stats).
- Ground collision: instant death in both modes.
- Ceiling: same as now (clamp, no damage).
- Shield upgrades (existing skin shields + picked shields) still absorb a hit first.

## 4. Stages

- Stage = 15 pipes passed (`pipesInStage`), then stage clear.
- Difficulty: pipe gap shrinks per stage: `gap = max(105, 170 - (stage-1)*7 - score*0.3)`; speed uses existing `pipeSpeed()` plus `+12 * (stage-1)`.
- Stage clear: `+10 gold`, brief "STAGE N CLEAR" banner (1.2s), then → `draft`.
- Every 3rd stage (3, 6, 9...) is a **BOSS stage** (see §7) — no draft after it; instead a relic reward.

## 5. Upgrade draft (the core STS loop)

- `draft` state: 3 random cards from the pool (no duplicates), rendered as 3 tappable cards over a dimmed game.
- Picking a card: add to `run.upgrades`, return to `ready` (tap to start next stage).
- Card pool (id, name, desc, apply):
  - `feather` — Feather: gravity -10% (stacks multiplicatively, min 0.5x)
  - `midas` — Midas: +1 point per pipe
  - `shield` — Shield: +1 shield charge (max 3)
  - `vampire` — Vampire: a near-miss heals 1 HP (once per stage, stacks)
  - `magnet` — Magnet: pipes drift toward the bird's y while approaching (stacks: +0.5 drift rate per copy, max 1.5)
  - `greed` — Greed: +2 gold per pipe
  - `chip` — Fever Chip: fever threshold -10 (min 10)
  - `tough` — Tough: +1 max HP and heal 1
  - `slow` — Slow Mo: pipe speed -10% (stacks, min 0.6x)
- Effects apply via a `runMods()` function that computes effective values (gravity, speed, mult, fever threshold) from `run.upgrades` + skin powers. Classic uses the same function with empty upgrades.

## 6. Gold, path & merchant

- Gold sources: +1/pipe, +2 on near-miss, +10 stage clear, +15 boss kill, chests.
- **Map** (StS-style, fixed campaign): 16-row map generated at run start (`genMap()`), DOM + SVG. Rows of 1–3 nodes connected by edges; every node reachable. Node types: **STAGE** (60%), **CHEST** (20%), **MERCHANT** (20%); rows 3/7/11 = guaranteed **BOSS gates** (single node); last row = single **FINAL BOSS**.
- Flow: map → pick node → stop (stage/boss/chest/merchant) → upgrade draft → map. Stage counter advances per stop.
- Beat the final boss → **VICTORY** screen (saves `save.rl.victories`), PLAY AGAIN restarts.
- Merchant: "Heal 1 HP — 15g", "Lucky Coin: pay 20g, gain 35g", "Reroll upgrades — 10g", "Leave".
- Chest: +15–25g / relic (if not all owned) / +1 HP.
- Gold is run-only (lost on death).

## 7. Boss & relics

- Boss stops: tall pipe pair with a **moving gap**, each boss has a unique color theme + glowing eye on the gap edges. Four bosses with **multi-phase** patterns (each phase is a different mechanic, shown on the HP bar):
  - GAPLORD (6 passes, 1 phase): `sine` — baseline oscillation (red)
  - GAPLORD II (7, 2 phases): `sine` → `chase` — gap tracks your height (purple)
  - GAPLORD III (8, 2 phases): `sine` → `pulse` — gap breathes open/closed (orange)
  - FINAL BOSS (12, 3 phases): `sine` → `chase` → `pulse` (black/gold) — pipes are **spear pipes** (spikes, 2x damage)
  - Phase change: flash + shake + scream + "PHASE X/Y" popup. Magnet upgrade does NOT affect boss pipes.
- Survive → boss dead: `+15 gold` + the boss's **signature relic** (GAPLORD→golden, II→heart, III→coin, FINAL→prism; +10 gold if already owned), banner, → draft → map. Final boss → victory screen.
- Relic pool (id, name, desc):
  - `golden` — Golden Feather: fever lasts 15s
  - `heart` — Heart Pipe: start each stage with +1 HP (max maxHp)
  - `coin` — Coin Magnet: +1 gold per pipe (same as greed but free)
  - `prism` — Prism Shard: pipes 15% slower
- Relics apply via `runMods()` too.

## 8. Characters (skins = characters)

- In RL mode, the menu skin selector IS character select (same unlock rules).
- Each skin's existing power is its starting kit (Azure=compact, Rainbow=prism, Phantom=reborn, etc.).
- RL menu shows the selected skin's kit description under the character portrait.
- No new skins; just framing + display.

## 9. HUD & screens

- RL HUD additions (top, under score): `♥♥♥` hearts, `🪙 gold`, `Stage N`.
- Game over (RL): "Stage N — M pipes — K gold", best stage/pipes from `save.rl`.
- Draft/shop screens: DOM overlay (like the shop), not canvas.

## 10. Implementation phases (each verified before next)

1. **Phase 1 — core loop**: mode toggle, run state, HP + invuln, stage counter + stage-clear banner, draft screen with 9 cards, `runMods()`, RL game-over stats. (No gold/shop/boss yet.)
2. **Phase 2 — economy**: gold tracking + HUD, merchant screen (path node).
3. **Phase 3 — boss & relics**: boss stage, relic pool + rewards.
4. **Phase 4 — characters**: RL menu framing, kit display, `save.rl` bests on menu.

## 11. Constraints

- Single file `index.html`. No new dependencies.
- Classic mode behavior must not change (regression: play a classic run, same as before).
- `node --check` on extracted script after every phase.
- Keep functions small; new RL code in a clearly marked section (`/* ===== roguelike ===== */`).
