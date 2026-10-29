// Layout: keeps battles fitting on screen with no scrolling.
// The page itself is always exactly the window's size (see the layout
// section of css/style.css). Menus may scroll inside their panel, but a
// battle should show everything at once: the question, all four answers,
// the explanation and the buttons. When that doesn't fit, this shrinks
// the battle panel's text a little at a time until it does.

const BATTLE_FONT_MIN = 10;   // never shrink text below this (pixels)
const BATTLE_FONT_STEP = 0.5; // how much to shrink per try

let fitScheduled = false;

// The normal text size for the battle panel, from the CSS
function baseFontSize(panel) {
  panel.style.fontSize = "";  // drop any earlier shrinking
  return parseFloat(getComputedStyle(panel).fontSize);
}

function fitBattlePanel() {
  fitScheduled = false;
  const panel = document.getElementById("battle-panel");
  if (panel.hidden) {
    return;
  }
  let size = baseFontSize(panel);
  // scrollHeight is how tall the content wants to be; clientHeight is how
  // tall the panel actually is. While the content is taller, shrink it.
  while (panel.scrollHeight > panel.clientHeight + 1 && size > BATTLE_FONT_MIN) {
    size -= BATTLE_FONT_STEP;
    panel.style.fontSize = size + "px";
  }
}

// Refit once, on the next animation frame, however many changes happen
// at once (a new question changes many elements in one go).
function scheduleFit() {
  if (!fitScheduled) {
    fitScheduled = true;
    requestAnimationFrame(fitBattlePanel);
  }
}

// Refit whenever the battle panel's contents change: a new question, the
// explanation appearing, loot, skill buttons. A MutationObserver is the
// browser's way of saying "tell me when this part of the page changes".
// We don't watch the "style" attribute, so our own font changes don't
// trigger another refit.
const battleWatcher = new MutationObserver(scheduleFit);
battleWatcher.observe(document.getElementById("battle-panel"), {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["hidden", "class", "disabled"]
});

// Refit when the window changes size or a phone is turned
window.addEventListener("resize", scheduleFit);
