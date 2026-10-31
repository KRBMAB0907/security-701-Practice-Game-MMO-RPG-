"""Checks topic mastery and Su Root: answers counting toward ranks, the small damage bonus,
rank-up messages, old saves, Su Root's tab at camp (needs-work list, every topic), and drills
(no timer, no XP, no enemy, answers still count, Back to camp). Saves screenshots.

Run from anywhere:  python tests/mastery.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8823", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []; missing = []; failures = []

def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (" | " + str(detail) if detail != "" else ""))
    if not ok:
        failures.append(name)

def page(b, save, mode="learner", viewport=(1100, 1000)):
    ctx = b.new_context(viewport={"width": viewport[0], "height": viewport[1]}, device_scale_factor=1)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: missing.append(m.text) if "Missing image" in m.text else None)
    pg.on("dialog", lambda d: d.accept())
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8823/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    pg.wait_for_timeout(300)
    return pg

def answer(pg, right):
    # Click the right answer (or a wrong one) for the question on screen
    correct = pg.evaluate("currentQuestionAnswer()")
    index = correct if right else (correct + 1) % 4
    pg.click(f"#choices button >> nth={index}")

# An old save from before mastery existed: no "mastery" field
OLD_SAVE = {"level": 5, "xp": 10, "classId": "analyst", "clearedZones": [], "nextItemId": 1, "tree": {},
            "inventory": [], "equipped": {"tool": None, "armor": None, "module": None}}

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = page(b, OLD_SAVE)
        check("old save gets empty mastery", pg.evaluate("JSON.stringify(save.mastery)") == "{}")

        # The question on screen isn't stored anywhere global, so tests read
        # the right answer from the question bank by its text
        pg.evaluate("""() => { window.currentQuestionAnswer = () => {
            const text = document.getElementById('question-text').textContent;
            return questions.find(q => q.question === text).answer; }; }""")

        # Ranks and the damage bonus, worked out directly
        check("no rank at 4 right", pg.evaluate("save.mastery['control-types'] = {right: 4, asked: 4}; masteryRank('control-types')") == 0)
        check("Novice at 5", pg.evaluate("save.mastery['control-types'] = {right: 5, asked: 9}; rankName(masteryRank('control-types'))") == "Novice")
        check("Master at 50", pg.evaluate("save.mastery['control-types'] = {right: 50, asked: 60}; rankName(masteryRank('control-types'))") == "Master")
        skill = "skills.find(s => s.id === 'patch-deploy')"  # topic: control-types
        check("Master = +8% for the skill", pg.evaluate(f"masteryBonus({skill})") == 8)
        pg.evaluate("save.mastery = {}")

        # In a real fight: answers count, and a rank-up makes skills hit harder
        pg.evaluate("enemyHitChance = () => 0")  # the enemy never hits, so the fight is predictable
        pg.click("#zone-list button >> nth=0"); pg.wait_for_timeout(200)
        pg.evaluate("save.mastery['control-types'] = {right: 4, asked: 4}")
        base = pg.evaluate(f"(enemy.phases = null, enemy.weakness = 'none', skillDamage({skill}))")
        pg.evaluate(f"useSkill({skill})")
        answer(pg, True)
        pg.wait_for_function("!turnInProgress")
        check("fight answer counted", pg.evaluate("save.mastery['control-types']") == {"right": 5, "asked": 5}, pg.evaluate("save.mastery['control-types']"))
        check("rank-up message shows", "MASTERY UP" in pg.inner_text("#feedback") and "Novice" in pg.inner_text("#feedback"), pg.inner_text("#feedback")[-90:])
        after = pg.evaluate(f"skillDamage({skill})")
        check("Novice adds about 2% damage", after > base and after <= round(base * 1.03) + 1, f"{base} -> {after}")
        pg.screenshot(path="mastery_rankup.png")
        check("mastery is saved", pg.evaluate("JSON.parse(localStorage.getItem('secplus-rpg-save')).mastery['control-types'].right") == 5)

        # Su Root's tab: needs-work list and all topics
        pg.evaluate("""save.mastery = { 'social-engineering': {right: 1, asked: 5}, 'encryption': {right: 3, asked: 4},
                                        'control-types': {right: 5, asked: 5}, 'hashing-integrity': {right: 0, asked: 2} }""")
        pg.evaluate("showMap()"); pg.wait_for_timeout(200)  # leave the fight halfway
        pg.click("#camp-button"); pg.click("#trainer-tab"); pg.wait_for_timeout(300)
        check("Su Root tab opens", pg.is_visible("#camp-content .mastery-help"))
        check("Su Root is greeting", "Su Root" in pg.inner_text("#camp-greeting"), pg.inner_text("#camp-greeting"))
        known = pg.evaluate("Object.keys(topicNames)")
        weak = pg.evaluate("weakestTopics()")
        expected = [t for t in ["social-engineering", "encryption"] if t in known]  # worst first; 100% and too-few-answers are left out
        check("needs work: worst first, skips 100% and <3 answers", weak == expected, weak)
        check("every topic has a row", pg.locator("#camp-content details .mastery-row").count() == len(known),
              pg.locator("#camp-content details .mastery-row").count())
        check("5 domain boxes", pg.locator("#camp-content details.mastery-domain").count() == 5)
        pg.locator("#game").screenshot(path="mastery_camp_scene.png"); pg.screenshot(path="mastery_tab.png")

        # A drill: no timer, no XP, no enemy; answers still count
        xp_before = pg.evaluate("[save.level, save.xp]")
        topic = known[0]
        pg.evaluate(f"save.mastery = {{}}")
        pg.click("#camp-content details summary >> nth=0")  # open Domain 1's box
        pg.click(f"#camp-content details .mastery-row[data-topic='{topic}'] button")
        pg.wait_for_timeout(200)
        check("drill shows a question", pg.is_visible("#question-area") and pg.is_hidden("#skills"))
        check("drill has no timer", pg.is_hidden("#timer"))
        check("drill keeps the camp scene", pg.evaluate("isCampOpen() && currentZone === null && enemy.maxHp === 0"))
        check("drill question is on the topic", pg.evaluate(f"questions.find(q => q.question === document.getElementById('question-text').textContent).topic") == topic)
        for i in range(5):
            answer(pg, i != 2)  # miss the third one
            pg.wait_for_timeout(100)
            if i < 4:
                check(f"next question button {i + 1}", pg.inner_text("#next-button") == "Next question", pg.inner_text("#next-button"))
                pg.click("#next-button")
        check("drill done after 5", pg.inner_text("#next-button") == "Drill again" and "4 of 5" in pg.inner_text("#battle-log"), pg.inner_text("#battle-log"))
        check("Su Root talks", pg.evaluate("speech !== null"))
        pg.locator("#game").screenshot(path="mastery_drill_scene.png"); pg.screenshot(path="mastery_drill.png")
        check("drill answers counted", pg.evaluate(f"save.mastery['{topic}']") == {"right": 4, "asked": 5}, pg.evaluate(f"save.mastery['{topic}']"))
        check("drill gives no XP", pg.evaluate("[save.level, save.xp]") == xp_before)
        pg.click("#next-button"); pg.wait_for_timeout(100)
        check("drill again starts at question 1", "Question 1 of 5" in pg.inner_text("#battle-log"), pg.inner_text("#battle-log"))
        check("back button says Back to camp", pg.inner_text("#map-button") == "Back to camp" or pg.is_hidden("#map-button"))
        answer(pg, True); pg.wait_for_timeout(100)
        pg.click("#map-button"); pg.wait_for_timeout(200)
        check("back to camp, drill over", pg.is_visible("#camp-panel") and pg.evaluate("drillTopic") is None)

        # A normal fight afterwards is a normal fight again
        pg.click("#camp-back-button"); pg.click("#zone-list button >> nth=0"); pg.wait_for_timeout(200)
        check("fight has an enemy again", pg.evaluate("enemy.maxHp > 0 && !isCampOpen()"))
        pg.evaluate(f"useSkill({skill})")
        check("fight timer is back (Learner)", pg.is_visible("#timer"))
        answer(pg, False); pg.wait_for_function("!turnInProgress")
        check("fight's back button says Back to map", pg.inner_text("#map-button") == "Back to map" or pg.is_hidden("#map-button"), pg.inner_text("#map-button"))

        # Phone size: the drill still fits without page scrolling
        pg2 = page(b, OLD_SAVE, viewport=(375, 667))
        pg2.click("#camp-button"); pg2.click("#trainer-tab"); pg2.wait_for_timeout(200)
        pg2.click("#camp-content details summary >> nth=0")
        pg2.click("#camp-content details .mastery-row >> nth=0 >> button")
        pg2.wait_for_timeout(300)
        check("phone: page doesn't scroll", pg2.evaluate("document.documentElement.scrollHeight <= innerHeight"))
        pg2.screenshot(path="mastery_phone.png")
        b.close()
finally: srv.terminate()
print("missing images:", missing or "none"); print("page errors:", errors or "none")
print("ALL PASSED" if not failures and not errors and not missing else f"FAILED: {failures}")
