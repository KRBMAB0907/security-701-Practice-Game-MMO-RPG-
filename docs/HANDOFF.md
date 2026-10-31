# Handoff: where the project stands

Written 2026-10-29 when the work moved to Claude Code. Read `CLAUDE.md` first for how to work on this project and with Kaleb.

## Status

All five areas are built and playable from level 1 to the final boss: 33 zones, 144 enemies, 69 skills, 3 classes, a 30-node skill tree, 6 ascendancies (2 per class), loot in five tiers with legendaries, a home camp for smelting, crafting and topic mastery drills, pixel art for everything, and a screen layout that fits laptops, desktops and phones without scrolling.

Last commit on GitHub: `a635dc2 Balance for tree and gear (WIP, balance runs pending)`. The ascension feature below isn't on `main` yet.

## Latest feature: topic mastery and Su Root (built 2026-10-31 on branch claude/admiring-cerf-o62yoq, not on main yet)

Kaleb asked for topic mastery with a trainer at the home camp who shows it. He chose:

- **Small bonuses:** every right answer counts toward its topic (fights and drills). Ranks Novice 5, Practitioner 15, Expert 30, Master 50 right answers; each rank gives **+2% damage** with skills on that topic (max +8%; a skill uses its best topic). Numbers in `MASTERY_RANKS` / `MASTERY_DAMAGE_PER_RANK` in `js/config.js`. Added to the tree and ascension bonuses, not multiplied.
- **Drills: yes.** "Drill" on any topic gives 5 questions on it with **no timer, no XP, no enemy and nothing crossed out** (Elimination Engine / Expert Witness are off in drills, so it's honest practice). Answers still count toward mastery. This is the camp's one exception to "no questions at camp": the menus stay calm, a drill only starts when you press Drill.
- **The trainer is Su Root**, a hacker in a black hat with a green band. Third tab at camp ("Su Root: mastery and drills"). Shows a "Needs work" list (lowest accuracy, at least 3 answers, under 100%) and every topic grouped by domain in fold-out boxes, with rank, right/asked, accuracy, a bar to the next rank and a Drill button. During drills he talks in a speech bubble (lines in `data/camp.json`).
- Rank-ups show in the answer explanation ("MASTERY UP: ... is now Novice").
- Mastery isn't touched by switching class (it's what you know, not your character); "Reset progress" clears it with everything else.

Files: new `js/mastery.js`, `tests/mastery.py`, `assets/sprites/npcs/su-root.png`. Changed `index.html`, `css/style.css`, `data/camp.json`, `js/config.js`, `js/state.js` (`save.mastery`, `drillTopic`), `js/camp.js` (third tab, speech bubble), `js/combat.js` (`masteryBonus` in `skillDamage`, buttons during drills), `js/questions.js` (`recordAnswer`, drill branch), `js/timer.js`, `js/render.js` (`drawSpeechBubble` now takes a speaker), `tools/make_sprites.py`, `tools/check_game_data.py`, docs. Only `su-root.png` was saved from `make_sprites.py`: running it rewrites every PNG, so the other files were put back unchanged.

**Tested 2026-10-31:** `tests/mastery.py` (33 checks) passed; the other 10 browser tests and the full playthrough (33 zones) ran with no page errors; both checkers found no problems.

**Still to do:** Kaleb playtests. Then gear affixes and set items (ideas below).

### Ideas agreed to explore next: affixes and set items

Affixes (Rare+ gear): prefix + base + "of" suffix, each a real concept with a one-line definition. Prefixes: Salted (+damage), Hashed (+weak point), Zero-Day (first hit +50%), Tokenized (heal on correct), Federated (+domain damage), Obfuscated (enemies hit less), Sandboxed (first hit taken halved), Hardened (less damage), Signed (+XP). Suffixes: of Persistence (heal), of Least Privilege (less damage), of Availability (+time), of Exfiltration (+drops), of Reconnaissance (+XP), of Lateral Movement (overkill carries over), of Rate Limiting (cap on a hit), of Redundancy (+health). Risky ones: Unpatched, Legacy, Shadow IT.

Set items (3 pieces, bonus at 2 and 3, each drops in its own area): CIA Triad (Foundry), Cyber Kill Chain (Breach Wastes), Zero Trust Architecture (Citadel), Incident Response Kit (Operations Deep), Governance Charter (Council Spire), PKI Chain of Trust (any finale). Kaleb hasn't picked which yet.

## Previous feature: home camp (merged into main 2026-10-31)

Kaleb asked for a home camp with a Blacksmith who smelts gear down and a Crafter who uses the pieces to make new gear. He chose:

- **Scrap per tier:** smelting gives scrap of the item's own tier (Common, Uncommon, Rare, Epic Scrap; legendaries give Legendary Cores). 2 scrap per item, 3 cores per legendary.
- **The Crafter does all four:** forge new gear (pick the item type and tier, Common to Epic; it's made at your level so you can wear it right away), upgrade an item one tier (up to Epic), re-level an old item to your level, and craft a legendary of your choice.
- **No questions at camp:** it's a calm break from quizzing, just menus.
- **A camp scene:** a "Home camp" button on the map. The game screen shows a night camp (tent, forge, anvil, campfire, workbench) with the player, the Blacksmith and the Crafter; an arrow bobs over whoever's menu is open.

Costs (all in `data/camp.json`): forge 4 scrap of that tier; upgrade 6 scrap of the current tier; re-level 2 scrap of the item's tier (1 core for legendaries); legendary 2 cores + 4 Epic Scrap. Legendaries can only be crafted from cores, which only come from smelting legendaries, so crafting lets players *choose* a legendary but doesn't make them less rare (that was a settled decision). Equipped items can't be smelted (unequip first), and Rare or better asks before smelting.

Files: new `data/camp.json`, `js/camp.js`, `tests/camp.py`, `assets/backgrounds/camp.png`, `assets/sprites/npcs/blacksmith.png` and `crafter.png`. Changed `index.html`, `css/style.css`, `js/state.js` (`save.materials`, `campData`), `js/loot.js` (`buildItem()` and `itemValue()` split out of `makeItem()` so crafting builds items the same way drops do), `js/render.js`, `js/sprites.js`, `js/map.js`, `js/main.js`, `tools/make_sprites.py`, `tools/check_game_data.py`, docs.

**Tested 2026-10-31:** `tests/camp.py` (28 checks) passed; all 8 regression tests and the full playthrough (33 zones) ran with no page errors; both checkers found no problems.

**Still to do:** Kaleb playtests the camp and the costs. A "Smelt all Common" button (keeps equipped items) was added after. Open question: whether forged gear should cost more since it's made at your level.

## Previous feature: ascension (built 2026-10-31, waiting for Kaleb's review)

Kaleb's choices:

- **Like PoE2: each class chooses 1 of 2 ascendancies.** Defender: Blue Team Lead or Firewall Architect. Analyst: Threat Hunter or Forensic Investigator. Cryptographer: Cipher Master or PKI Warden.
- **Points only from the 5 area finale bosses**, 1 each (first win; worked out from cleared zones, so old saves get theirs right away).
- **Resetting is free**, and a reset lets you choose either ascendancy again. Switching class clears it.
- **A circle like PoE2:** a round "ASCENSION" emblem at the top of the skill tree screen. With 0 points it's greyed out and says "Locked: need an Ascension point to unlock"; after the first point it's unlocked. It opens a round board: tier 1 on the inner ring, tier 2 on the middle ring (opens at 2 points spent), 2 capstones at the top (open at 4, only one allowed). 8 nodes and 5 points, so you can't take everything.
- **Hold off on balance until all the new features are in.** No balance runs were done for ascension.

Ascension nodes add new mechanics instead of plain stats: blocking the first hits, a cap on big hits, counterattacks, thorns, critical hits, answer streaks, partial damage on misses, lifesteal, a once-per-fight save at 1 health, and crossing out a wrong answer. Each node is a real Security+ concept with a one-line definition, like the tree. The node numbers are in `data/ascension.json`; shared limits (crit multiplier, streak caps, emergency heal thresholds) are in `js/config.js`; the list of special stats is at the top of `js/ascension.js`.

Files: new `data/ascension.json`, `js/ascension.js`, `tests/ascension.py`. Changed `index.html`, `css/style.css`, `js/config.js`, `js/state.js`, `js/main.js`, `js/map.js`, `js/combat.js` (the effects), `js/leveling.js`, `js/timer.js`, `js/questions.js`, `js/classes.js`, `js/skilltree.js` (draws the emblem), `tools/check_game_data.py`, docs.

**Tested 2026-10-31:** `tests/ascension.py` (31 checks, including the effects in real fights) passed, all 9 other browser tests ran with no page errors, and both checkers found no problems.

**Still to do:** Kaleb reviews and playtests, then the balance pass for the tree, gear and ascension together.

## Balance work in progress (Kaleb's commits after the skill tree)

- Enemy damage now grows with the zone's level (`ENEMY_DAMAGE_GROWTH` in `js/config.js`) instead of a fixed step per area; `enemyDamageScale` was removed from `data/areas.json`.
- Enemy health grows 2% per zone level on Learner and Hard (`enemyHpGrowth` in `MODES`), to keep up with the tree and gear.
- Gear gains 5% per item level instead of 10% (`LEVEL_STAT_BONUS`), and extra question time is capped at +50% of the mode's time (`MAX_EXTRA_TIME`).
- `tests/damage_calc.py` compares the numbers and `tests/balance_built.py` runs built characters; the balance runs are still pending.

## Skill tree (committed in `0d0f72c`, fixed in `9390f6e`)

Kaleb asked for a skill tree inspired by Path of Exile 2 and Diablo 4, with the cyber theme. He chose:

- **Layout B (Diablo 4 style):** a full-screen menu with five columns, one per exam domain. Each column has Tier 1, Tier 2 (opens at 4 points spent anywhere), Tier 3 (10) and a Keystone (18).
- **Points from leveling:** 1 per level after 1, plus **3 bonus points for beating the final boss** (The Shadow Council). Points are worked out from level, not stored, so losing levels takes points away.
- **Resetting costs levels, the same as switching class** (20% of your levels). Switching class also refunds the tree, since it lowers your level.
- **PoE2 feel for keystones:** each branch ends in a keystone that is strong but has a downside, and you can only have one: Zero Trust, Assume Breach, Defense in Depth, Rapid Response, Accept the Risk.

Every node is named after a real Security+ concept and shows a one-line definition, so the tree teaches too. Small nodes take up to 3 points, notables 1. Clicks are only planned until you press "Lock in", because taking points out costs levels.

The tree holds 60 points; one clean playthrough reaches about level 34 (36 points with the final boss bonus), so players have to choose.

Files: new `data/skilltree.json`, `js/skilltree.js`, `tests/skill_tree.py`. Changed `index.html`, `css/style.css`, `js/config.js` (keystone numbers), `js/state.js`, `js/main.js`, `js/map.js`, `js/combat.js`, `js/leveling.js`, `js/loot.js`, `js/timer.js`, `js/questions.js`, `js/classes.js`, `tools/check_game_data.py`, docs.

**Tested 2026-10-29:** `tests/skill_tree.py` (26 checks) passed, and all 8 regression tests ran with no page errors. Both checkers found no problems. The balance runs weren't re-run: their simulated players don't spend tree points, so their numbers are unchanged, but real players with a tree will find the game somewhat easier than the tables below.

A Paragon-style endgame board with glyphs was discussed and left for later.

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
- Quests for players who want direction (he agreed to these early on). (The study log is now Su Root's mastery tab.)
- The balance pass once all new features are in, then maybe a Paragon-style endgame board.
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
