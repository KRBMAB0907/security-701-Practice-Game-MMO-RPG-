"""Loads the game at 13 screen sizes (Windows/Linux laptops and desktops, phones and tablets both ways) and checks there's no page scrolling, the game screen is fully visible, and the most crowded battle fits. Prints the text size each one ends up at.

Run from anywhere:  python tests/screen_fit.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8798", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
ALL = ["controls-yard","core-sanctum","change-gate","cipher-vault","foundry-heart"]
SCREENS = [  # name, width, height, mobile
 ("Windows laptop 1366x768", 1366, 768, False), ("Windows 1280x720", 1280, 720, False), ("Desktop 1920x1080", 1920, 1080, False),
 ("Linux 1600x900", 1600, 900, False), ("Short window 1280x600", 1280, 600, False), ("Narrow window 800x900", 800, 900, False),
 ("iPhone portrait 390x844", 390, 844, True), ("Small Android 360x640", 360, 640, True), ("Pixel 412x915", 412, 915, True),
 ("iPhone landscape 844x390", 844, 390, True), ("Small Android landscape 640x360", 640, 360, True),
 ("Tablet portrait 768x1024", 768, 1024, True), ("Tablet landscape 1024x768", 1024, 768, True),
]
MEASURE = """() => {
  const p = document.getElementById('battle-panel'), c = document.getElementById('game').getBoundingClientRect();
  const page = document.scrollingElement;
  return {pageScroll: page.scrollHeight > innerHeight + 1 || page.scrollWidth > innerWidth + 1,
          canvasOnScreen: c.top >= 0 && c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1,
          canvas: Math.round(c.width) + 'x' + Math.round(c.height),
          panelFits: p.scrollHeight <= p.clientHeight + 1, font: parseFloat(getComputedStyle(p).fontSize)};
}"""
WORST = """() => {
  const total = q => q.question.length + q.choices.join('').length + q.explanation.length;
  const q = [...questions].sort((a, b) => total(b) - total(a))[0];
  currentSkill = skills.find(s => s.topics.includes(q.topic)) || skills[0];
  document.getElementById('skills').hidden = true;
  playTurn = () => {}; showQuestion(q); checkAnswer(q, (q.answer + 1) % 4);
  setLog('Victory! +250 XP. LEVEL UP! You are now level 7. The next sub-zone is unlocked, and a long message wraps onto several lines.');
  const item = makeItem(tierById('epic'), 1); save.inventory.push(item);
  setLootMessage({item, kept: true});
  document.getElementById('next-button').hidden = false; document.getElementById('map-button').hidden = false;
  return q.id;
}"""
results = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, w, h, mobile in SCREENS:
            ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
            pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(name + ": " + str(e)))
            save = {"level": 9, "xp": 0, "classId": "analyst", "clearedZones": ALL[:4], "inventory": [], "equipped": {"tool": None, "armor": None, "module": None}, "nextItemId": 1}
            pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
            pg.goto("http://localhost:8798/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click("button[data-mode=learner]")
            menu = pg.evaluate(MEASURE)
            pg.evaluate("enterZone(zones.find(z => z.id === 'foundry-heart'))"); pg.wait_for_timeout(150)
            skillsState = pg.evaluate(MEASURE)
            qid = pg.evaluate(WORST); pg.wait_for_timeout(150)
            worst = pg.evaluate(MEASURE)
            slug = name.split()[0].lower() + f"_{w}x{h}"
            pg.screenshot(path=f"fit_{slug}.png")
            results.append((name, menu, skillsState, worst))
            ok = not menu["pageScroll"] and not skillsState["pageScroll"] and not worst["pageScroll"] and worst["canvasOnScreen"] and skillsState["panelFits"] and worst["panelFits"]
            print(f"{'OK  ' if ok else 'FAIL'} {name:33} canvas {worst['canvas']:9} | skills fit {skillsState['panelFits']} @{skillsState['font']}px | worst question {qid} fits {worst['panelFits']} @{worst['font']}px | page scroll {worst['pageScroll'] or skillsState['pageScroll'] or menu['pageScroll']}")
            ctx.close()
        b.close()
finally: srv.terminate()
print("page errors:", errors)
