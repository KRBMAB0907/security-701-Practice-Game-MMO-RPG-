# Security+ RPG

A free, browser-based RPG that helps you study for the **CompTIA Security+ (SY0-701)** exam. Every attack you make is powered by answering a real exam-style question. This is a 5-area game to help you pass Security+, and I will keep updating it as time goes on.

**[Play it here](https://krbmab0907.github.io/security-701-Practice-Game-MMO-RPG-/)** (no account or install needed)

It fits any screen: laptops and desktops on Windows, Linux or Mac, tablets, and phones in either orientation. Battles always fit on screen without scrolling.

## How it plays

- **Pick a class:** Defender (tank), Analyst (support, heals on correct answers) or Cryptographer (high damage, low health). Switching later costs 20% of your levels.
- **Pick a difficulty:** Fun (no timer), Learner (60 seconds per question) or Hard (30 seconds, tougher enemies).
- **Choose a skill.** Each skill is tied to an exam topic, and using it means answering a question on that topic.
- **Answer correctly** and your skill hits. Answer wrong or run out of time and your attack misses. Every answer shows an explanation, so mistakes still teach.
- **Then the enemy attacks.** Every turn the enemy swings back, and each mode sets how often it lands (Fun 50%, Learner 65%, Hard 75%; bosses +10%). When it misses, you dodge.
- **Enemies talk back.** The battle log narrates each hit and miss, and enemies taunt you in a speech bubble with lines about the exam topic they stand for.
- **Hit weak points.** Enemies are weak to certain topics, and matching skills deal 1.5x damage. Bosses change weakness halfway through the fight.
- **Collect loot.** Enemies drop gear in five tiers, from Common to Legendary: tools boost damage, armor boosts health, and modules add time to the question timer. Equip drops right after a battle, see your gear on a Minecraft-style equipment screen, and watch your armor appear on your character. Legendaries have special effects, like removing a wrong answer from every question. Hard mode finds rare gear more often.
- **Home camp.** Visit the Blacksmith to smelt gear you don't need into scrap (one kind per tier, and Legendary Cores from legendaries). Take the scrap to the Crafter to forge new gear of the type and tier you choose, upgrade an item one tier, bring an old item up to your level, or craft the legendary you want.
- **Retro pixel art.** Each area has its own scene, every class has its own sprite, and enemies come in 10 body types tinted to look different. Bosses wear crowns.
- **Skill tree.** Every level gives a point to spend in a tree with five branches, one per exam domain. Each node is named after a Security+ concept and explains it (Confidentiality, Hardening, Defense in Depth...). Tiers open as you spend more, and a keystone at the bottom of each branch changes how you play, with a downside (only one allowed). Beating the final boss gives 3 bonus points. Taking points back costs levels, like switching class.
- **Ascension.** Beat an area's finale boss to earn an Ascension point (5 in total). Like Path of Exile 2, each class chooses one of two ascendancies (Defender: Blue Team Lead or Firewall Architect; Analyst: Threat Hunter or Forensic Investigator; Cryptographer: Cipher Master or PKI Warden), each with a round board of 8 nodes that add new mechanics like critical hits, blocking and answer streaks. Resetting is free.
- **Level up and unlock areas.** Clear a sub-zone's boss to unlock the next one. Progress saves in your browser.

## World map

The five areas follow the five SY0-701 domains:

| Area | Domain | Exam weight | Status |
| --- | --- | --- | --- |
| The Foundry | 1.0 General Security Concepts | 12% | Playable: all four sub-zones plus the Foundry Heart finale |
| The Breach Wastes | 2.0 Threats, Vulnerabilities, and Mitigations | 22% | Playable: 5 sub-zones plus the Breach Core finale |
| The Citadel | 3.0 Security Architecture | 18% | Playable: 4 sub-zones plus the Citadel Keep finale |
| The Operations Deep | 4.0 Security Operations | 28% | Playable: 9 sub-zones plus the Operations Core finale |
| The Council Spire | 5.0 Security Program Management and Oversight | 20% | Playable: 6 sub-zones plus the Spire Summit finale |

Clearing an area's finale unlocks the next area. All five areas are playable, backed by 450 original questions covering all 28 exam objectives (at least 15 each).

## Run it on your own computer

The game loads its data with `fetch`, which browsers block for files opened directly from disk, so run a small local web server:

```bash
git clone https://github.com/KRBMAB0907/security-701-Practice-Game-MMO-RPG-.git
cd security-701-Practice-Game-MMO-RPG-
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Project structure

```
index.html              the page: game screen and panels
css/style.css           how everything looks
js/                     the game code, one file per job (loaded in this order)
  config.js             difficulty modes and balance numbers
  state.js              game state and the two fighters
  storage.js            loading data files, saving progress
  leveling.js           XP, leveling and the death penalty
  classes.js            picking and switching classes
  loot.js               drops, gear and the gear screen
  skilltree.js          skill tree points, bonuses and the tree screen
  ascension.js          ascendancies, their effects and the round board
  camp.js               the home camp: smelting and crafting
  dialogue.js           battle narration and enemy taunts
  sprites.js            loading, tinting and animating the pixel art
  render.js             drawing the canvas and the game loop
  map.js                screens, the map and unlocking
  combat.js             skills, weaknesses, damage, winning and losing
  timer.js              the question countdown
  questions.js          showing questions and checking answers
  layout.js             shrinks battles to fit the screen
  main.js               starting the game (loads last)
data/
  topics.json           every domain, objective and topic
  areas.json            the 5 areas, in order, and which data files they use
  areas/                one file per built area: its skills, enemies and zones
  classes.json          class stats and favored skills
  loot.json             loot tiers, drop chances and item names
  skilltree.json        skill tree branches and nodes
  ascension.json        the 6 ascendancies and their nodes
  camp.json             home camp scrap names and crafting costs
  dialogue.json         narration lines and taunts for every topic
  questions/            question bank, one file per domain
assets/
  sprites/              class, enemy, camp and item sprites, armor overlays and the boss crown
  backgrounds/          one scene per area, plus the home camp
docs/
  ART.md                how to edit the art in Piskel
  HANDOFF.md            where the project stands and what's next
tests/                  browser tests and balance runs (see tests/README.md)
CLAUDE.md               notes for Claude Code when working on this project
tools/
  check_questions.py    checks the question bank for mistakes
  check_game_data.py    checks areas, zones, enemies, skills, classes, skill tree, ascension, camp and art link up
  make_sprites.py       draws the starter pixel art
```

Game **content lives in `data/`, separate from the code**. Adding enemies, zones or questions means editing JSON, not JavaScript. Building a new area means writing its file in `data/areas/` and pointing to it from `data/areas.json`. Then run `python tools/check_game_data.py` to make sure everything links up.

## Adding questions

Each question looks like this:

```json
{
  "id": "d1-001",
  "objective": "1.1",
  "topic": "control-types",
  "question": "A company installs bollards outside its building entrance...",
  "choices": ["Detective", "Corrective", "Preventive", "Compensating"],
  "answer": 2,
  "explanation": "Bollards physically stop a vehicle before it can cause harm..."
}
```

`answer` is the position of the correct choice, counting from 0. The `topic` must exist in `data/topics.json`. After editing, run the checker:

```bash
python tools/check_questions.py
```

It catches duplicate IDs, invalid answers, unknown topics and more, and it should end with "No problems found."

**All questions are original**, written from the public exam objectives. Please don't add real exam questions ("brain dumps"). CompTIA can revoke certifications for using them.

## Built with

Plain HTML, CSS and JavaScript, with no frameworks or build tools, so the code is easy to read and learn from. It's hosted free on GitHub Pages.

## Disclaimer

This is an independent study project. It is not affiliated with or endorsed by CompTIA. Security+ is a trademark of CompTIA. Always check the official exam objectives on CompTIA's website.

## License

[MIT](LICENSE): free to use, change and learn from.
