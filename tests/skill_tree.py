"""Checks the skill tree: points from levels and the final boss, tier locks, planning and locking in,
one keystone only, stat bonuses in a fight, keystones, resetting (costs levels) and switching class.

Run from anywhere:  python tests/skill_tree.py
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, json
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8781", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []; failures = []

def check(label, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + label + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(label)

def fresh(b, save, mode="learner"):
    ctx = b.new_context(viewport={"width": 1280, "height": 720}); pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8781/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    return pg

def node(pg, node_id):
    # The tree screen's button for one node
    return pg.locator(f".tree-node[data-node='{node_id}']")

try:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # An old save from before the skill tree (no "tree" field), level 10
        pg = fresh(b, {"level": 10, "xp": 0, "clearedZones": ["controls-yard"], "classId": "defender"})
        check("old save gets an empty tree", pg.evaluate("JSON.stringify(save.tree)") == "{}")
        check("map button shows 9 points", pg.inner_text("#tree-button") == "Skill tree (9 points)", pg.inner_text("#tree-button"))

        pg.click("#tree-button")
        check("tree screen opens", pg.is_visible("#tree-panel"))
        check("5 branches", pg.locator(".tree-branch").count() == 5)
        check("tier 2 starts locked", node(pg, "availability").is_disabled())
        hp_before = pg.evaluate("playerMaxHp()")
        for _ in range(3):
            node(pg, "integrity").click()
        check("Integrity full at 3/3", "3/3" in node(pg, "integrity").inner_text() and node(pg, "integrity").is_disabled())
        check("planned points don't count yet", pg.evaluate("playerMaxHp()") == hp_before)
        node(pg, "confidentiality").click()
        check("tier 2 opens after 4 points", not node(pg, "availability").is_disabled())
        pg.click("#tree-undo-button")
        check("undo clears the plan", pg.evaluate("treePointsSpent(treePlan)") == 0)
        for _ in range(3):
            node(pg, "integrity").click()
        node(pg, "confidentiality").click()
        pg.click("#tree-save-button")
        check("lock in saves", pg.evaluate("JSON.stringify(save.tree)") == '{"integrity":3,"confidentiality":1}')
        check("+18 max health from Integrity", pg.evaluate("playerMaxHp()") == hp_before + 18)
        check("5 points left", "Points to spend: 5" in pg.inner_text("#tree-summary"), pg.inner_text("#tree-summary"))

        # Leaving with planned points asks first
        node(pg, "threat-intel").click()
        pg.once("dialog", lambda d: d.dismiss()); pg.click("#tree-back-button")
        check("cancel keeps you on the tree", pg.is_visible("#tree-panel"))
        pg.once("dialog", lambda d: d.accept()); pg.click("#tree-back-button")
        check("leaving drops the plan", pg.is_visible("#map-panel") and pg.evaluate("save.tree['threat-intel']") is None)

        # Bonuses in a real fight
        pg.click("#zone-list button >> nth=0")
        check("fight starts at the higher max health", pg.evaluate("player.maxHp") == hp_before + 18)
        base = pg.evaluate("(() => { const t = save.tree; save.tree = {}; const d = skillDamage(skills[0]); save.tree = t; return d; })()")
        boosted = pg.evaluate("skillDamage(skills[0])")
        check("Confidentiality raises skill damage", boosted > base, f"{base} -> {boosted}")
        pg.screenshot(path="skill_tree_fight.png")

        # Reset costs levels, like switching class
        pg.evaluate("showMap()"); pg.click("#tree-button")  # leave mid-fight
        pg.once("dialog", lambda d: d.accept()); pg.click("#tree-reset-button")
        check("reset costs 2 levels (20% of 10)", pg.evaluate("save.level") == 8)
        check("reset empties the tree", pg.evaluate("JSON.stringify(save.tree)") == "{}")

        # Keystones: only one, and their effects. Level 30 has 29 points.
        pg = fresh(b, {"level": 30, "xp": 0, "clearedZones": [], "classId": "cryptographer"})
        pg.click("#tree-button")
        check("keystones locked below 18 points", node(pg, "zero-trust").is_disabled())
        for small in ["confidentiality", "integrity", "threat-intel", "vuln-scanning", "segmentation", "redundancy"]:
            for _ in range(3):
                node(pg, small).click()
        check("keystones open at 18 points", not node(pg, "zero-trust").is_disabled())
        node(pg, "assume-breach").click()
        check("a second keystone is blocked", "only one keystone" in node(pg, "zero-trust").inner_text())
        pg.click("#tree-save-button")
        pg.screenshot(path="skill_tree_screen.png", full_page=True)
        pg.click("#tree-back-button"); pg.click("#zone-list button >> nth=0")
        check("Assume Breach starts you at 70% health", pg.evaluate("player.hp === Math.round(player.maxHp * 0.7)"),
              pg.evaluate("player.hp + '/' + player.maxHp"))
        hit_before = pg.evaluate("(() => { const t = save.tree; save.tree = {}; const c = enemyHitChance(); save.tree = t; return c; })()")
        check("Threat Intel lowers enemy hit chance by 6%", abs(pg.evaluate("enemyHitChance()") - (hit_before - 0.06)) < 1e-9)

        # Switching class refunds the tree
        pg.evaluate("showMap()"); pg.click("#change-class-button")
        pg.once("dialog", lambda d: d.accept()); pg.click("#class-list button >> nth=0")
        check("switching class empties the tree", pg.evaluate("JSON.stringify(save.tree)") == "{}")

        # Beating the final boss gives 3 extra points
        all_zones = pg.evaluate("zones.map(z => z.id)")
        pg = fresh(b, {"level": 34, "xp": 0, "clearedZones": all_zones, "classId": "analyst"})
        check("final boss bonus: 33 + 3 = 36 points", pg.evaluate("treePointsEarned()") == 36, str(pg.evaluate("treePointsEarned()")))

        # Phone size: tree screen fits the width (the panel itself may scroll)
        ctx = b.new_context(viewport={"width": 390, "height": 844}); ph = ctx.new_page()
        ph.on("pageerror", lambda e: errors.append(str(e)))
        ph.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps({'level': 12, 'classId': 'analyst'}))})")
        ph.goto("http://localhost:8781/"); ph.wait_for_selector("#mode-panel:not([hidden])"); ph.click("button[data-mode=fun]")
        ph.click("#tree-button")
        check("no sideways scrolling on a phone", ph.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
        ph.screenshot(path="skill_tree_phone.png")
        b.close()
finally: srv.terminate()
print("\npage errors:", errors)
print("ALL PASSED" if not failures and not errors else f"{len(failures)} FAILED")
