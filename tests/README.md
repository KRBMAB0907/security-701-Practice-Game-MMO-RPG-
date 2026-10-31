# Tests

Each script opens the game in a headless Chromium browser with Playwright, plays parts of it by itself, and prints what it found. They start their own small web server, so you don't need one running.

## Setup (once)

```bash
pip install playwright
playwright install chromium
```

On Arch you may need `pip install --user playwright` or a virtual environment (`python -m venv .venv && source .venv/bin/activate`).

## Running

From the project folder:

```bash
python tests/full_playthrough.py
```

Each script defaults to the project folder it lives in; you can pass another path as the first argument. Each one uses its own port, so they can run side by side. Screenshots go to `tests/screenshots/`, which git ignores.

## Regression tests (run after gameplay or layout changes)

| Script | What it checks | Time |
| --- | --- | --- |
| `full_playthrough.py` | The whole game, all 33 zones, as a new player | 3–5 min |
| `hit_chance.py` | Enemy hit rates match the settings; turn order | ~1 min |
| `screen_fit.py` | No scrolling and everything visible at 13 screen sizes | ~1 min |
| `classes.py` | Class stats, switching, reset, old saves | < 1 min |
| `legendaries.py` | Legendary effects, gear level limits, full bag | < 1 min |
| `loot.py` | Drop odds and equipping | < 1 min |
| `gear_screen.py` | Equip now button, worn armor, gear screen | < 1 min |
| `timer.py` | Hard timer runs out; Fun has no timer | < 1 min |
| `skill_tree.py` | Tree points, tiers, lock in, keystones, bonuses, reset and class switch | < 1 min |
| `ascension.py` | Ascension lock, points, choosing, tiers, free reset, and effects in fights | < 1 min |

## Balance runs (run after changing damage, health or hit chance)

These play each zone many times as simulated players (different classes, modes and how often they answer right) and print how many times each one died. They don't pass or fail; compare the numbers with the table in `docs/HANDOFF.md`.

| Script | Area | Time |
| --- | --- | --- |
| `balance_new_player.py` | The Foundry, from level 1 | a few min |
| `balance_breach_wastes.py` | The Breach Wastes | a few min |
| `balance_citadel.py` | The Citadel | several min |
| `balance_operations_deep.py` | The Operations Deep | 10+ min |
| `balance_council_spire.py` | The Council Spire | 10+ min |
| `balance_finales.py` | Tries needed for the last two finales on Hard | several min |
| `damage_calc.py` | No browser: hits to die in every zone, to try numbers before changing the game | seconds |

## Notes for writing new tests

- After clicking an answer, wait for the enemy's turn to finish: `page.wait_for_function("!turnInProgress")`.
- To make enemy attacks predictable, replace the roll: `page.evaluate("enemyHitChance = () => 1")` (always hits) or `() => 0` (never hits).
- Tests that start mid-game build a save in `localStorage` (key `secplus-rpg-save`) before loading the page.
