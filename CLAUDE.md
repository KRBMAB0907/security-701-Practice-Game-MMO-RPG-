# CLAUDE.md

Notes for Claude Code working on this project. Read `docs/HANDOFF.md` too: it says where things stand right now and what's next.

## What this is

A free browser RPG for studying **CompTIA Security+ SY0-701**, styled loosely after Path of Exile 2 and Diablo 4 with retro cyber pixel art. Every attack is powered by answering an exam-style question. Five areas map to the five exam domains (33 zones, 144 enemies, 450 original questions). It's public on GitHub (`KRBMAB0907/security-701-Practice-Game-MMO-RPG-`) and meant to be served by GitHub Pages.

## Working with Kaleb (the owner): these rules come first

Kaleb knows a little Java and Python, uses Arch Linux and VS Code, and is comfortable with clone, commit and push. He set three rules:

1. **Explain what you're doing and why.** He wants to understand the reasoning, not just get code.
2. **We are partners: ask before doing something, instead of interrupting with surprises.** For a clear, small change you can build it and then explain what you did and why (he asked to speed things up this way). For genuinely ambiguous design choices (how a mechanic should feel, what to show players), ask first, with options.
3. **This project is to help others learn too.** Keep the code readable for beginners: plain names, short comments that explain *why*, no clever tricks, no frameworks or build tools.

After a change, tell him in plain words what changed, which files, and why, then suggest a commit message. He reviews and pushes himself unless he asks you to.

## Running it

```bash
python -m http.server 8000     # then open http://localhost:8000
```

The game loads JSON with `fetch`, so opening `index.html` straight from disk won't work.

## Checks to run after every change

```bash
python tools/check_questions.py     # question bank: should end "No problems found."
python tools/check_game_data.py     # areas, zones, enemies, skills, classes, loot, art all link up
for f in js/*.js; do node --check "$f"; done
```

Browser tests and balance runs are in `tests/` (see `tests/README.md`). Run the regression tests after gameplay changes and the balance runs after changing damage, health, hit chance or anything in `MODES`.

## How the code is laid out

- **No build step.** `index.html` loads 17 plain scripts in order, all sharing global scope: config, state, storage, leveling, classes, loot, skilltree, camp, dialogue, sprites, render, map, combat, timer, questions, layout, main. `main.js` starts the game and must load last.
- **Load order matters.** A file can call functions from later files only at runtime, not while it is loading. Button listeners set up early should use arrow functions, e.g. `() => showMap()`, not `showMap` directly (this bug happened once).
- **Content lives in `data/`, separate from code.** Topics, areas, zones, enemies, skills, classes, loot, the skill tree, dialogue and questions are JSON. New content should almost never need JavaScript changes.
- **All balance numbers live in `js/config.js`** (`MODES` plus constants). Change them there, not inline.
- **Game units:** positions are in a 320×180 virtual screen (`GAME_W`/`GAME_H`). The canvas is drawn at real screen resolution with `ctx.setTransform` and image smoothing off, so pixel art stays sharp and text stays smooth.
- **Sprites** are 2-frame 16×16 sheets (idle bob). Enemy sprites are grayscale and get tinted at runtime (cached). Armor is drawn as an overlay on the class sprite; bosses are drawn 2× with a crown. `tools/make_sprites.py` (Pillow) draws the starter art; `docs/ART.md` explains editing in Piskel.
- **Layout:** the page is a `100dvh` grid that never scrolls; menus may scroll inside themselves. `js/layout.js` shrinks the battle panel's font until it fits (a MutationObserver re-checks when content changes).
- **Saves** go to `localStorage` (key `secplus-rpg-save`), wrapped in try/catch. Old saves are upgraded by merging with `newSave()` defaults, so add new save fields there.
- **Skill tree** (`js/skilltree.js`, `data/skilltree.json`): five branches, one per domain, with tiers that open by points spent. Points aren't saved, they're worked out from level (+3 after the final boss), and `save.tree` only stores points per node. Combat asks `treeBonus(stat)`, `treeDomainDamage(skill)` and `hasKeystone(id)`. A new stat or keystone needs code in those places and in `tools/check_game_data.py`; new nodes using existing stats are JSON only.
- **Home camp** (`js/camp.js`, `data/camp.json`): the Blacksmith smelts bag items into scrap (`save.materials`, one count per loot tier; legendaries give Legendary Cores). The Crafter forges new gear at the player's level, upgrades a tier, re-levels, and crafts legendaries. Every cost is `{ tier: amount }` in `camp.json`. Crafted items are built with `buildItem()` in `loot.js`, the same as drops. The camp scene is drawn by `drawCamp()` when the camp panel is open.
- **Turn flow** (`js/combat.js`): `checkAnswer` → `playTurn(correct, timedOut)` → your attack or miss → pause `ENEMY_TURN_DELAY_MS` → `enemyAttacks()` rolls `enemyHitChance()` → `finishTurn()`. `turnInProgress` is true during the pause; tests wait for it to go false.

## Content rules

- **Questions must be original**, written from the public SY0-701 objectives. Never add real exam questions (brain dumps).
- Every objective keeps at least 15 questions; every topic used by a skill must have questions.
- Each topic in `data/topics.json` has taunts in `data/dialogue.json` (keep them short: they show in a speech bubble).

## Commits

Kaleb writes short commit messages in his own words (e.g. "Final zone", "Armor update #2", "Window update to size"). Suggest something short like that and let him choose.
