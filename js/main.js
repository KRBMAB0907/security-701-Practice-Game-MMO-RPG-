// Starting the game: the mode picker and loading all the data.
// This file loads last, after every other script.

function chooseMode(modeKey) {
  currentMode = MODES[modeKey];
  // New players pick a class first; returning players go straight to the map
  if (currentClass() === undefined) {
    showClassPicker();
  } else {
    showMap();
  }
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
    // Load the shared files at the same time and wait for all to finish
    const [topicData, areaList, classData, lootData, dialogueData, treeData, ascensionFile, campFile] = await Promise.all([
      loadJson("data/topics.json"),
      loadJson("data/areas.json"),
      loadJson("data/classes.json"),
      loadJson("data/loot.json"),
      loadJson("data/dialogue.json"),
      loadJson("data/skilltree.json"),
      loadJson("data/ascension.json"),
      loadJson("data/camp.json")
    ]);

    // Then each built area's own file and its domain's questions, all at once.
    // Areas still being built have "file": null and are skipped.
    areas = areaList.areas;
    const builtAreas = areas.filter(area => area.file !== null);
    const loaded = await Promise.all(builtAreas.map(area =>
      Promise.all([loadJson(area.file), loadJson(area.questions)])
    ));

    // Merge every area's skills, enemies, zones and questions into the shared lists
    areas.forEach(area => { area.zones = []; });
    builtAreas.forEach((area, i) => {
      const [areaData, questionData] = loaded[i];
      skills.push(...areaData.skills);
      enemyTypes.push(...areaData.enemies);
      questions.push(...questionData.questions);
      areaData.zones.forEach(zone => {
        zone.area = area.id;  // remember which area each zone belongs to
        area.zones.push(zone);
        zones.push(zone);
      });
    });

    // Flatten domains -> objectives -> topics into one id -> name lookup
    topicData.domains.forEach(domain => {
      domain.objectives.forEach(objective => {
        objective.topics.forEach(topic => {
          topicNames[topic.id] = topic.name;
          topicDomains[topic.id] = domain.id;
        });
      });
    });

    topicData.domains.forEach(domain => {
      domainNames[domain.id] = domain.name;
    });

    classes = classData.classes;
    lootTable = lootData;
    dialogue = dialogueData;
    campData = campFile;

    // Put every branch's nodes in one list, and remember each node's domain
    skillTree = treeData;
    skillTree.branches.forEach(branch => {
      branch.nodes.forEach(node => {
        node.domain = branch.domain;
        treeNodes.push(node);
      });
    });
    ascensionData = ascensionFile;
    preloadArt();  // start loading images in the background

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
