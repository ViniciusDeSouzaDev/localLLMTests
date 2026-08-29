# Balance Spec — Late-Game Pacing & Merchant Pricing

Three balance fixes for Roguelike mode. Classic mode must remain byte-identical in behavior.

## 1. Fever speed nerf

**Problem:** fever multiplies pipe speed by 1.15 (`pipeSpeed()`, game.js:261). In late stages the base speed is already ~300+ px/s, so fever spikes to ~345+ — too fast to react.

**Change:** fever speed multiplier `1.15` → `1.05`.

- `pipeSpeed()`: `(140 + Math.min(score,40)*1.5) * (feverT > 0 ? 1.05 : 1)`
- Everything else about fever is unchanged: trigger every `feverEvery` pipes (30, chips reduce, min 10), duration 10s (15s Golden Feather, ×2 Storm), score ×2, music/tint.
- Rationale: late-game difficulty comes from stage scaling (§2), not from fever. Fever should feel like a reward, not a spike.

**Verify:** stage 10, score 40, no fever: 236 px/s. With fever: 246 px/s (was 308 → 338).

## 2. Late-game stage pacing

**Problem:** stage speed bonus is linear `12 * (stage-1)` (game.js:262). By stage 10 it adds +108 px/s on top of the capped 200 base — late game is too fast.

**Change:** diminishing returns on the stage bonus:

```
stageBonus(stage) = stage < 2 ? 12 * (stage - 1) : 12 * Math.sqrt(stage - 1)
```

- `pipeSpeed()` becomes: `base * feverMult + stageBonus(run.stage) + pathBonus` (path bonuses +14/+10 unchanged).
- Stage 0 (classic) and stage 1 keep the old formula exactly → classic regression-safe.
- Gap formula (`pipeGap()`) unchanged — it already floors at 105/95/90.

| stage | old bonus | new bonus | total (score 40, no fever) |
|-------|-----------|-----------|-----------------------------|
| 1     | 0         | 0         | 200                         |
| 3     | 24        | 17        | 217                         |
| 5     | 48        | 24        | 224                         |
| 10    | 108       | 36        | 236                         |
| 15    | 168       | 45        | 245                         |
| 20    | 228       | 52        | 252                         |

**Verify:** early game (stages 1–5) feels the same; late game (10+) is ~100 px/s slower than before.

## 3. Merchant dynamic pricing

**Problem:** merchant prices are flat (`MERCH_BASE`, roguelike.js:147). Players can stack "broken" items (extra shields, chips below the fever floor, +HP past what's useful) at the same price forever.

**Change:** price scales with how many copies the player already owns:

```
price(key) = ceil(base * (1 + 0.5 * min(owned, 4)))
```

- `owned` per key:
  - `shield` / `tough` / `chip` → count of that id in `run.upgrades`
  - `heal` → new counter `run.merchHeals` (heals bought this run, reset in `resetRun()`)
  - `reroll` → new counter `run.rerolls` (rerolls used this run)
  - `coin` / `phoenix` / `anchor` → one-shot, `owned` stays 0 (already disabled once used)
- Cap: multiplier maxes at `1 + 0.5*4 = 3x` (e.g. shield: 25 → 38 → 50 → 63 → 75 → 75).
- `Merchant's Favor` still applies **after** the dynamic multiplier (50% off, reroll free) — favor now discounts the inflated price.
- UI: always render the live price on each merchant button (today only the favor branch rewrites price text; generalize `refreshMerchant()` to set `merchPrice(key) + 'g'` for every offer, EN+PT).
- Help screen (`buildHelp()`) keeps base prices as reference text — no change.

**Verify:** buy shield 3× in one run: prices shown 25g → 38g → 50g → 63g → 75g (capped). With favor: 13g → 19g → 25g → 32g → 38g. Heal 4×: 15 → 23 → 30 → 38 → 45 (capped).

## Constraints

- No new dependencies; changes confined to `js/game.js` (pipeSpeed), `js/roguelike.js` (merchPrice, resetRun, refreshMerchant), `js/ui.js` (price labels).
- Classic mode: `pipeSpeed()` output for stage 0 must be identical to today.
- `node --check` on extracted script after each section.
- Test order: §2 → §1 → §3 (each independently verifiable in a play session).
