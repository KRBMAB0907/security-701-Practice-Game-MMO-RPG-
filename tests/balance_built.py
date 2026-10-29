"""Balance: the last two areas (Operations Deep, Council Spire) as a player who
spends skill tree points and wears gear. The other balance runs use a player
with neither, so this one checks the game is still a challenge with a build.

Before every zone the simulated player gets Uncommon gear at the zone's level
and spends all their tree points in a sensible order (damage and health first).
It prints deaths per area and the average correct answers per fight.
Targets late in the game: about 3 answers per normal enemy and 6-8 per boss.

Run from anywhere:  python tests/balance_built.py     (several minutes)
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, json, random
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8771", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []

BEFORE_OPS = ["controls-yard", "core-sanctum", "change-gate", "cipher-vault", "foundry-heart",
              "actors-den", "vector-fields", "vulnerability-rift", "malware-marsh", "hardening-forge", "breach-core",
              "cloud-spires", "perimeter-walls", "data-vaults", "resilience-bastion", "citadel-keep"]
AREAS = [("Operations Deep", 16, 10), ("Council Spire", 26, 7)]  # name, starting level, zones

# Where the simulated player puts tree points, in order (node, points). Tier 1
# first, so tiers 2 and 3 are open by the time it reaches them.
TREE_PLAN = [("confidentiality", 3), ("integrity", 3), ("vuln-scanning", 3), ("redundancy", 3),
             ("hardening", 3), ("automation", 3), ("non-repudiation", 1), ("incident-response", 1),
             ("hot-site", 1), ("gap-analysis", 1), ("business-impact", 1), ("edr", 1),
             ("due-care", 3), ("threat-intel", 3), ("segmentation", 3), ("mitigation", 1),
             ("log-review", 3), ("governance", 1), ("indicators", 1), ("infrastructure-as-code", 1)]

# Runs in the page: spend all tree points from the plan, and wear Uncommon gear at this level
BUILD_JS = """([plan, level]) => {
  save.tree = {};
  let left = treePointsEarned();
  for (const [node, points] of plan) {
    const spend = Math.min(points, left);
    if (spend > 0) { save.tree[node] = spend; left -= spend; }
  }
  save.inventory = []; save.equipped = { tool: null, armor: null, module: null };
  for (const slot of ["tool", "armor", "module"]) {
    let item = makeItem(tierById("uncommon"), level);
    while (item.slot !== slot) { item = makeItem(tierById("uncommon"), level); }
    save.inventory.push(item); save.equipped[slot] = item.id;
  }
  writeSave();
}"""

def load_save(pg, save):
    # Open the game, put our save in its storage, then reload so the game reads it
    pg.goto("http://localhost:8771/")
    pg.evaluate("text => localStorage.setItem('secplus-rpg-save', text)", json.dumps(save))
    pg.reload(); pg.wait_for_selector("#mode-panel:not([hidden])")

def run(b, mode, cls, acc, seed):
    pg = b.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    rng = random.Random(seed); results = []
    cleared = list(BEFORE_OPS)
    for name, level, zone_count in AREAS:
        save = {"level": level, "xp": 0, "classId": cls, "inventory": [], "equipped": {"tool": None, "armor": None, "module": None},
                "nextItemId": 1, "clearedZones": cleared, "tree": {}}
        load_save(pg, save); pg.click(f"button[data-mode={mode}]")
        deaths = 0; normal = []; boss = []
        for z in range(zone_count):
            zone_level = pg.evaluate(f"selectedArea.zones[{z}].level")
            pg.evaluate(BUILD_JS, [TREE_PLAN, zone_level])
            pg.click(f"#zone-list button >> nth={z}"); d = 0; answers = 0
            while True:
                st = pg.evaluate("({over: fightOver, won: fightWon, boss: enemy.boss})")
                if st["over"]:
                    if not st["won"]:
                        d += 1; answers = 0
                        if d > 25: break
                        pg.click("#next-button"); continue
                    (boss if st["boss"] else normal).append(answers); answers = 0
                    if pg.is_visible("#next-button"): pg.click("#next-button"); continue
                    break
                weak = pg.query_selector("#skills button.weak-point"); (weak or pg.query_selector("#skills button")).click()
                t = pg.inner_text("#question-text"); idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
                right = rng.random() < acc; answers += right
                pg.click(f"#choices button >> nth={idx if right else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
                if not pg.evaluate("fightOver"): pg.click("#next-button")
            deaths += d; pg.click("#map-button")
        cleared = pg.evaluate("save.clearedZones")
        avg = lambda xs: sum(xs) / len(xs) if xs else 0
        results.append((name, deaths, avg(normal), avg(boss), pg.evaluate("save.level")))
    pg.close()
    return results

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        print("Built player: tree points spent, Uncommon gear at each zone's level")
        print("answers = correct answers per won fight (normal / boss)\n")
        for mode, cls, acc in [("learner", "analyst", 0.5), ("learner", "cryptographer", 0.65), ("learner", "defender", 0.9),
                               ("hard", "cryptographer", 0.65), ("hard", "defender", 0.75)]:
            for name, deaths, normal, boss, lvl in run(b, mode, cls, acc, 5):
                print(f"  {mode:8} {cls:13} {int(acc*100)}%  {name:16} deaths {deaths:2}  answers {normal:3.1f} / {boss:3.1f}  ends level {lvl}")
            print()
        b.close()
finally: srv.terminate()
print("page errors:", errors)
