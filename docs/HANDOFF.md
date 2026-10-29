# Handoff: where the project stands

Written 2026-10-29 when the work moved to Claude Code. Read `CLAUDE.md` first for how to work on this project and with Kaleb.

## Status

All five areas are built and playable from level 1 to the final boss: 33 zones, 144 enemies, 69 skills, 3 classes, loot in five tiers with legendaries, pixel art for everything, and a screen layout that fits laptops, desktops and phones without scrolling.

Last commit on GitHub: `7e335ea Claude add` (the hit-chance and dialogue feature below).

## Latest feature: enemy hit chance and dialogue (committed in `7e335ea`)

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
