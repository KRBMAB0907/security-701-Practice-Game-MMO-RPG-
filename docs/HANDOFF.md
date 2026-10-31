# Handoff: where the project stands

Written 2026-10-29 when the work moved to Claude Code. Read `CLAUDE.md` first for how to work on this project and with Kaleb.

## Status

All five areas are built and playable from level 1 to the final boss: 33 zones, 144 enemies, 69 skills, 3 classes, a 30-node skill tree, loot in five tiers with legendaries, a home camp for smelting and crafting, pixel art for everything, and a screen layout that fits laptops, desktops and phones without scrolling.

Last commit on GitHub: `7e335ea Claude add` (the hit-chance and dialogue feature below).

## Latest feature: home camp (not committed yet)

Kaleb asked for a home camp with a Blacksmith who smelts gear down and a Crafter who uses the pieces to make new gear. He chose:

- **Scrap per tier:** smelting gives scrap of the item's own tier (Common, Uncommon, Rare, Epic Scrap; legendaries give Legendary Cores). 2 scrap per item, 3 cores per legendary.
- **The Crafter does all four:** forge new gear (pick the item type and tier, Common to Epic; it's made at your level so you can wear it right away), upgrade an item one tier (up to Epic), re-level an old item to your level, and craft a legendary of your choice.
- **No questions at camp:** it's a calm break from quizzing, just menus.
- **A camp scene:** a "Home camp" button on the map. The game screen shows a night camp (tent, forge, anvil, campfire, workbench) with the player, the Blacksmith and the Crafter; an arrow bobs over whoever's menu is open.

Costs (all in `data/camp.json`): forge 4 scrap of that tier; upgrade 6 scrap of the current tier; re-level 2 scrap of the item's tier (1 core for legendaries); legendary 2 cores + 4 Epic Scrap. Legendaries can only be crafted from cores, which only come from smelting legendaries, so crafting lets players *choose* a legendary but doesn't make them less rare (that was a settled decision). Equipped items can't be smelted (unequip first), and Rare or better asks before smelting.

Files: new `data/camp.json`, `js/camp.js`, `tests/camp.py`, `assets/backgrounds/camp.png`, `assets/sprites/npcs/blacksmith.png` and `crafter.png`. Changed `index.html`, `css/style.css`, `js/state.js` (`save.materials`, `campData`), `js/loot.js` (`buildItem()` and `itemValue()` split out of `makeItem()` so crafting builds items the same way drops do), `js/render.js`, `js/sprites.js`, `js/map.js`, `js/main.js`, `tools/make_sprites.py`, `tools/check_game_data.py`, docs.

**Tested 2026-10-31:** `tests/camp.py` (24 checks) passed; all 8 regression tests and the full playthrough (33 zones) ran with no page errors; both checkers found no problems.

**Still to do:** Kaleb playtests the camp and the costs. Ideas he might want: a "smelt all Common" button, and whether forged gear should cost more since it's made at your level.

## Earlier feature: skill tree

Kaleb asked for a skill tree inspired by Path of Exile 2 and Diablo 4, with the cyber theme. He chose:

- **Layout B (Diablo 4 style):** a full-screen menu with five columns, one per exam domain. Each column has Tier 1, Tier 2 (opens at 4 points spent anywhere), Tier 3 (10) and a Keystone (18).
- **Points from leveling:** 1 per level after 1, plus **3 bonus points for beating the final boss** (The Shadow Council). Points are worked out from level, not stored, so losing levels takes points away.
- **Resetting costs levels, the same as switching class** (20% of your levels). Switching class also refunds the tree, since it lowers your level.
- **PoE2 feel for keystones:** each branch ends in a keystone that is strong but has a downside, and you can only have one: Zero Trust, Assume Breach, Defense in Depth, Rapid Response, Accept the Risk.

Every node is named after a real Security+ concept and shows a one-line definition, so the tree teaches too. Small nodes take up to 3 points, notables 1. Clicks are only planned until you press "Lock in", because taking points out costs levels.

The tree holds 60 points; one clean playthrough reaches about level 34 (36 points with the final boss bonus), so players have to choose.

Files: new `data/skilltree.json`, `js/skilltree.js`, `tests/skill_tree.py`. Changed `index.html`, `css/style.css`, `js/config.js` (keystone numbers), `js/state.js`, `js/main.js`, `js/map.js`, `js/combat.js`, `js/leveling.js`, `js/loot.js`, `js/timer.js`, `js/questions.js`, `js/classes.js`, `tools/check_game_data.py`, docs.

**Tested 2026-10-29:** `tests/skill_tree.py` (26 checks) passed, and all 8 regression tests ran with no page errors. Both checkers found no problems. The balance runs weren't re-run: their simulated players don't spend tree points, so their numbers are unchanged, but real players with a tree will find the game somewhat easier than the tables below.

**Still to do:** Kaleb playtests the tree. Then the **ascension board** (he asked for it; build it after the tree playtest):
- One board **per class**, like PoE2 ascendancies (switching class resets it).
- Ascension points come **only from the 5 area finale bosses** (Foundry Overseer, Breach Lord, The Architect, Silent Operator, Shadow Council): 1 point each, first win only, 5 in total.
- A Paragon-style endgame board with glyphs was discussed and left for later.

## Previous feature: enemy hit chance and dialogue (committed in `7e335ea`)

Kaleb asked for enemies to have a % chance to hit, with dialogue based on whether they hit or the player misses. He chose: **the enemy attacks every turn**, and **both enemy taunts and battle narration**.

How it works now:

- Your turn: a right answer hits; a wrong answer or a timeout is a miss ("MISS" floats over the enemy).
- Then, after a 0.65 s pause, the enemy attacks every turn: it lunges, then either hits or you dodge (you hop back and "MISS" floats over you).
- Hit chance per mode (`MODES` in `js/config.js`): Fun 50%, Learner 65%, Hard 75%. Bosses get +10%, capped at 95%. The fight intro tells the player the enemy's hit chance.
- Since enemies now attack every turn (not only on wrong answers), enemy damage was lowered: Fun 6, Learner 9, Hard 13.
- Narration lines and taunts are in `data/dialogue.json`: narration for each outcome with `{skill}`, `{enemy}`, `{damage}` placeholders, general taunts, and 2 taunts for each of the 70 exam topics. `js/dialogue.js` picks them; `js/render.js` draws the speech bubble.
- The Silent Operator (Operations Deep finale) was lowered from 1700 to 1400 HP because Hard mode became too hard there.

Files changed: `index.html`, `js/config.js`, `js/state.js`, `js/combat.js`, `js/questions.js`, `js/render.js`, `js/main.js`, `data/areas/operations-deep.json`. New: `js/dialogue.js`, `data/dialogue.json`.

**Tested 2026-10-29:** all 8 regression tests in `tests/` passed with no page errors, and both checkers found no problems. The full playthrough cleared all 33 zones; measured enemy hit rates matched the settings within about 1%.

**Still to do for this feature:** Kaleb playtests it and reports anything that feels off.

### Balance results with hit chance

Deaths per area for a simulated player (class, mode, % of questions answered right). Lower is easier; 0 means never died.

| Area | Learner, Cryptographer 65% | Hard, Cryptographer 65% | Hard, Defender 75% | Learner, Analyst 50% |
| --- | --- | --- | --- | --- |
| Foundry (new player) | 0 | 5 | 0 | 0 |
| Breach Wastes | 0 | 4 | 0 | 0 |
| Citadel | 0 | 1 | 4 | 1 |
| Operations Deep | — | — | 1 | 5 |
| Council Spire | — | 8 | 0 | 5 |

Finale tries on Hard (Cryptographer, 65%), five runs each: Operations Core 0, 4, 1, 0, 0 after the HP change (was 23–25, basically unbeatable); Spire Summit 6, 4, 3, 6, 7.

## Known issues

- **GitHub Pages isn't on yet.** The README's "Play it here" link shows GitHub's 404 ("There isn't a GitHub Pages site here"). Fix: on GitHub, Settings → Pages → Build and deployment → Source "Deploy from a branch", branch `main`, folder `/ (root)`, Save, then wait a minute or two. Kaleb paused this, so check with him first.
- A custom domain is planned. When it's bought: add it in Settings → Pages, which creates a `CNAME` file, and set the DNS records GitHub shows.

## Ideas for next (ask Kaleb which, in what order)

- Fix anything from his playtest of the hit-chance version.
- Turn on GitHub Pages, then the custom domain.
- Quests for players who want direction (he agreed to these early on), and a study log that shows which topics the player keeps missing.
- The ascension board (see above), then maybe a Paragon-style endgame board.
- More classes or multiclassing.
- More questions per objective, especially the heavy domains (4.0 is 28% of the exam).
- Restyle or hand-edit the starter art in Piskel (`docs/ART.md`).
- A bigger gear bag (currently 24 slots).
- Updating for the next Security+ version when CompTIA releases it: the topic and question files are per-domain so they can be swapped.

## Design decisions already settled (don't reopen without asking)

- Difficulty modes: Fun (no timer), Learner (60 s), Hard (30 s, tougher, better loot).
- Death costs 25% of the current XP bar; it can't drop your level and stops at an empty bar.
- Switching class costs 20% of your levels and resets XP in the level.
- Loot tiers: Common, Uncommon, Rare, Epic, Legendary. Legendaries are rare; Hard mode finds them more often.
- One area unlocks at a time; clearing an area's finale opens the next.
- Battle text uses a smooth font, not pixel text (Kaleb found pixel text hard to read).
