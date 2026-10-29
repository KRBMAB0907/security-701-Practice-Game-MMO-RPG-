// Starting the game: the mode picker and loading all the data.
// This file loads last, after every other script.

function chooseMode(modeKey) {
  currentMode = MODES[modeKey];
  showMap();
}

// Each mode button stores its mode name in data-mode="..." in the HTML
document.querySelectorAll("#mode-panel button").forEach(button => {
  button.addEventListener("click", () => chooseMode(button.dataset.mode));
});

async function start() {
  requestAnimationFrame(gameLoop);  // start drawing right away
  loadSave();

  const status = document.getElementById("status");
  try {
    // Load all the files at the same time and wait for all to finish.
    // The Foundry only needs Domain 1 questions; later areas will load
    // their own domain file from data/questions/.
    const [topicData, questionData, combatData] = await Promise.all([
      loadJson("data/topics.json"),
      loadJson("data/questions/domain1.json"),
      loadJson("data/combat.json")
    ]);

    // Flatten domains -> objectives -> topics into one id -> name lookup
    topicData.domains.forEach(domain => {
      domain.objectives.forEach(objective => {
        objective.topics.forEach(topic => {
          topicNames[topic.id] = topic.name;
        });
      });
    });

    questions = questionData.questions;
    skills = combatData.skills;
    enemyTypes = combatData.enemies;
    zones = combatData.zones;

    status.hidden = true;
    showPanel("mode-panel");
  } catch (error) {
    // Most common cause: opening index.html directly instead of
    // through the local server (python -m http.server 8000)
    status.textContent = "Couldn't load game data. Are you running the local server?";
    console.error(error);
  }
}

start();
