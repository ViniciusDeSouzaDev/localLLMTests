# Path 2 — Design Doc

## Goal
After beating Path 1's final boss, the player can continue into **Path 2**: a harder map with a new node type (**Labyrinth**), stronger bosses, and new items. Beating Path 2's final boss is the true end of a run (**Ascension**).

## Flow
- Beat FINAL BOSS (Path 1) → victory screen as today, **plus** a `CONTINUE → PATH 2` button.
- Path 2 starts a new map (same node-picking UI). `run.stage` keeps incrementing (difficulty formulas already scale with it).
- Beat Path 2's final boss → **ASCENSION** screen (new save counter `save.rl.ascensions`), run ends.
- Dying anywhere = game over as today (no path-specific changes).

## Path 2 map
- 14 rows, widths `[2,2,3,1,3,2,3,1,3,2,3,1,2,1]`, boss rows `[3,7,11]`, final at row 13.
- Node roll: stage 55% / chest 15% / merchant 15% / **labyrinth 15%** (wide rows only, replaces elite).
- Path 2 difficulty on top of existing formulas:
  - `pipeSpeed`: +30 base
  - `pipeGap`: floor 95 (instead of 105), shrinks 9/stage (instead of 7)

## New node: Labyrinth 🌀
- Replaces elite on Path 2. 6 passes, reward **+25 gold + relic** (Path 2 relic pool).
- Mechanics: the corridor **breathes and drifts** — gap center oscillates (sine, amp 100, spd 2.6) AND gap size oscillates (±30%, slower period). Both top and bottom walls move.
- Implemented as new boss phase pattern `labyrinth` (reuses existing boss-pipe engine).

## Path 2 bosses
| Row | Name | Passes | Phases |
|---|---|---|---|
| 3 | GAPLORD IV | 9 | pulse 3.4 → sine (amp 140, spd 3.2) |
| 7 | GAPLORD V | 10 | sine (150, 3.4) → chase 1.4 → pulse 4.0 |
| 11 | THE WARDEN | 10 | pulse 3.8 → labyrinth → chase 1.6 |
| 13 | VOIDLORD (final) | 14 | sine (160, 3.6) → pulse 4.2 → labyrinth → chase 1.8 |

- Path 2 bosses drop Path 2 relics (see below); final drops `prism` as today.

## New items (Path 2 only)

### Relics (drop from labyrinths/bosses)
| id | icon | name | effect |
|---|---|---|---|
| anchor | ⚓ | Anchor | Base magnet 2 (pipes drift toward you) |
| phoenix | 🔥 | Phoenix | +1 revive (Reborn) |
| void | 🕳️ | Void Core | Fever every 15 pipes |
| echo | 📯 | Echo | Near-miss gives +3 gold (instead of +2) |

### Upgrade cards (added to Path 2 draft pool)
| id | icon | name | effect |
|---|---|---|---|
| storm | ⚡ | Storm | Fever lasts 2× as long |
| titan | 🗡️ | Titan | +1 max HP and heal 1 HP |

### Merchant (Path 2 adds)
| item | cost | effect |
|---|---|---|
| Phoenix | 40g | +1 revive |
| Anchor | 35g | base magnet 2 |

## Victory / saves
- `save.rl.victories` — Path 1 wins (unchanged).
- `save.rl.ascensions` — Path 2 wins (new).
- Victory screen: Path 1 shows `CONTINUE → PATH 2`; Ascension screen shows `ASCENSION!` + stats + PLAY AGAIN.

## Implementation checklist
1. Path 2 map data + `run.path` tracking (1/2)
2. Victory screen: continue button → generate Path 2 map
3. Difficulty: path-based speed/gap modifiers
4. Boss phase pattern `labyrinth` (gap + gapY both oscillate)
5. Path 2 bosses (GAPLORD IV/V, WARDEN, VOIDLORD) + Labyrinth node
6. Path 2 relics (anchor, phoenix, void, echo) + `mods()` wiring
7. Path 2 cards (storm, titan) in draft pool + `mods()` wiring
8. Path 2 merchant items
9. Ascension screen + save counter
10. `node --check` + playtest pass
