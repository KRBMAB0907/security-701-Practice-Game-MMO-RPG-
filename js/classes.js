// Classes: Defender, Analyst and Cryptographer. Picking one, and the
// cost of switching later. Class stats live in data/classes.json.

// The player's current class, or undefined if they haven't picked one
function currentClass() {
  return classes.find(c => c.id === save.classId);
}

// True if the player's class gives this skill a bonus
function isFavored(skill) {
  const playerClass = currentClass();
  return playerClass !== undefined && playerClass.favoredSkills.includes(skill.id);
}

// How many levels switching class would cost right now (never below level 1)
function classSwitchCost() {
  const loss = Math.round(save.level * CLASS_SWITCH_LEVEL_LOSS);
  return Math.min(loss, save.level - 1);
}

function showClassPicker() {
  showPanel("class-panel");
  const switching = currentClass() !== undefined;

  document.getElementById("class-intro").textContent = switching
    ? "Your class: " + currentClass().name + ". Switching costs 20% of your levels (" + classSwitchCost() + " right now) and refunds your skill tree and ascension points."
    : "Choose your class. You can switch later, but it costs 20% of your levels.";
  document.getElementById("class-cancel-button").hidden = !switching;

  const list = document.getElementById("class-list");
  list.innerHTML = "";

  classes.forEach(playerClass => {
    const button = document.createElement("button");
    button.textContent = playerClass.name + " - " + playerClass.style + " (" + playerClass.role + ")";

    const details = document.createElement("small");
    details.textContent = playerClass.description;
    button.appendChild(details);

    if (playerClass.id === save.classId) {
      button.disabled = true;  // can't switch to the class you already have
    }
    button.addEventListener("click", () => chooseClass(playerClass));
    list.appendChild(button);
  });
}

function chooseClass(playerClass) {
  if (currentClass() !== undefined) {
    const cost = classSwitchCost();
    const ok = confirm("Become a " + playerClass.name + "? You will lose " + cost + " level(s), and your skill tree and ascension points come back to spend again.");
    if (!ok) {
      return;
    }
    save.level -= cost;
    save.xp = 0;  // start the new level's XP bar fresh, so the cost is real
    // Fewer levels means fewer tree points, so the tree starts over too
    save.tree = {};
    // Ascendancies belong to one class, so the new class chooses again
    save.ascendancy = null;
    save.ascension = {};
  }
  save.classId = playerClass.id;
  writeSave();
  showMap();
}

document.getElementById("change-class-button").addEventListener("click", showClassPicker);
// The arrow function matters: map.js loads after this file, so showMap
// doesn't exist yet when this line runs. "() => showMap()" only looks it
// up when the button is clicked, after every script has loaded.
document.getElementById("class-cancel-button").addEventListener("click", () => showMap());
