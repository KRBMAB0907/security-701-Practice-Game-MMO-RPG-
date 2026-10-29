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
    ? "Your class: " + currentClass().name + ". Switching costs 20% of your levels (" + classSwitchCost() + " right now)."
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
    const ok = confirm("Become a " + playerClass.name + "? You will lose " + cost + " level(s).");
    if (!ok) {
      return;
    }
    save.level -= cost;
    save.xp = 0;  // start the new level's XP bar fresh, so the cost is real
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
