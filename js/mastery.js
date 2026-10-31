// Topic mastery and Su Root, the trainer at the home camp.
//
// Every answer counts toward its exam topic: save.mastery holds how many
// questions on each topic you've been asked and how many you got right.
// Right answers raise the topic's rank (Novice, Practitioner, Expert,
// Master; see MASTERY_RANKS in js/config.js), and each rank gives a small
// damage bonus to skills that use that topic. So studying a topic makes
// you better at fighting with it.
//
// Su Root shows every topic's rank and accuracy, lists the topics you keep
// missing, and runs drills: a few questions on one topic with no timer,
// no XP and no risk. Drills reuse the battle screen's question box.

// ---------------------------------------------------------------
// Counting answers and working out ranks
// ---------------------------------------------------------------

// { right, asked } for one topic (zeros if it's never come up)
function topicRecord(topicId) {
  return save.mastery[topicId] || { right: 0, asked: 0 };
}

// How many ranks the topic has reached: 0 (none yet) up to 4 (Master)
function masteryRank(topicId) {
  const right = topicRecord(topicId).right;
  return MASTERY_RANKS.filter(rank => right >= rank.correct).length;
}

// e.g. "Expert", or "Unranked" before the first rank
function rankName(rank) {
  return rank === 0 ? "Unranked" : MASTERY_RANKS[rank - 1].name;
}

// Accuracy as a whole percent, or null if never asked
function topicAccuracy(topicId) {
  const record = topicRecord(topicId);
  return record.asked === 0 ? null : Math.round(record.right / record.asked * 100);
}

// Called after every answer (in fights and drills).
// Returns the new rank's name if this answer reached one, otherwise null.
function recordAnswer(topicId, correct) {
  const before = masteryRank(topicId);
  const record = topicRecord(topicId);
  save.mastery[topicId] = { right: record.right + (correct ? 1 : 0), asked: record.asked + 1 };
  writeSave();
  const after = masteryRank(topicId);
  return after > before ? rankName(after) : null;
}

// Damage bonus in % for a skill: the best rank among the skill's topics.
// combat.js adds this to the skill tree and ascension bonuses.
function masteryBonus(skill) {
  const best = Math.max(...skill.topics.map(topicId => masteryRank(topicId)));
  return best * MASTERY_DAMAGE_PER_RANK;
}

// Every topic id, in exam order (domain 1 first)
function allTopicIds() {
  return Object.keys(topicNames);
}

// The topics you get wrong most often, worst first. A topic needs a few
// answers first, so one unlucky miss doesn't put it on the list.
function weakestTopics() {
  return allTopicIds()
    .filter(topicId => topicRecord(topicId).asked >= NEEDS_WORK_MIN_ANSWERS && topicAccuracy(topicId) < 100)
    .sort((a, b) => topicAccuracy(a) - topicAccuracy(b))
    .slice(0, NEEDS_WORK_COUNT);
}

// ---------------------------------------------------------------
// Su Root's menu at the camp (camp.js calls this for his tab)
// ---------------------------------------------------------------

function trainer() {
  return campData.npcs.find(person => person.id === "su-root");
}

// A random line from Su Root, with {placeholders} filled in (see dialogue.js)
function trainerLine(kind, values) {
  return fillLine(randomLine(trainer().lines[kind]), values || {});
}

function showTrainer(content) {
  const ranked = allTopicIds().filter(topicId => masteryRank(topicId) > 0).length;
  const help = document.createElement("p");
  help.className = "mastery-help";
  help.textContent = "Every right answer counts toward its topic. Ranks: " +
    MASTERY_RANKS.map(rank => rank.name + " " + rank.correct).join(", ") +
    " right answers. Each rank gives +" + MASTERY_DAMAGE_PER_RANK +
    "% damage with skills on that topic. Topics ranked: " + ranked + "/" + allTopicIds().length + ".";
  content.appendChild(help);

  // The topics to study next
  addHeading(content, "Needs work");
  const weak = weakestTopics();
  if (weak.length === 0) {
    content.appendChild(document.createTextNode(
      "Nothing yet. Answer at least " + NEEDS_WORK_MIN_ANSWERS + " questions on a topic and I'll tell you how you're doing."));
  }
  weak.forEach(topicId => content.appendChild(masteryRow(topicId)));

  // Every topic, grouped by domain. <details> is a built-in HTML box that
  // opens and closes when you click its <summary>, so the list stays short.
  addHeading(content, "All topics");
  Object.keys(domainNames).forEach(domainId => {
    const topics = allTopicIds().filter(topicId => String(topicDomains[topicId]) === domainId);
    const box = document.createElement("details");
    box.className = "mastery-domain";
    const summary = document.createElement("summary");
    const domainRanked = topics.filter(topicId => masteryRank(topicId) > 0).length;
    summary.textContent = "Domain " + domainId + ": " + domainNames[domainId] +
      " (" + domainRanked + "/" + topics.length + " ranked)";
    box.appendChild(summary);
    topics.forEach(topicId => box.appendChild(masteryRow(topicId)));
    content.appendChild(box);
  });
}

// One topic: its name and rank, a bar toward the next rank, and a Drill button
function masteryRow(topicId) {
  const record = topicRecord(topicId);
  const rank = masteryRank(topicId);
  const row = document.createElement("div");
  row.className = "mastery-row";
  row.dataset.topic = topicId;  // lets tests find a topic's row

  const info = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = topicName(topicId) + " · " + rankName(rank);
  info.appendChild(name);

  const details = document.createElement("small");
  const accuracy = topicAccuracy(topicId);
  let text = record.right + " right of " + record.asked + (accuracy === null ? "" : " (" + accuracy + "%)");
  const next = MASTERY_RANKS[rank];  // undefined once Master
  text += next ? " · " + (next.correct - record.right) + " more to " + next.name : " · fully mastered";
  if (rank > 0) {
    text += " · +" + rank * MASTERY_DAMAGE_PER_RANK + "% damage";
  }
  details.textContent = text;
  info.appendChild(details);

  // Progress from the last rank to the next one
  const track = document.createElement("div");
  track.className = "mastery-track";
  const bar = document.createElement("div");
  bar.className = "mastery-bar";
  const start = rank === 0 ? 0 : MASTERY_RANKS[rank - 1].correct;
  const fill = next ? (record.right - start) / (next.correct - start) : 1;
  bar.style.width = Math.round(fill * 100) + "%";
  track.appendChild(bar);
  info.appendChild(track);
  row.appendChild(info);

  row.appendChild(campButton("Drill", true, () => startDrill(topicId)));
  return row;
}

// ---------------------------------------------------------------
// Drills: DRILL_LENGTH questions on one topic. They use the battle
// screen for the question box, but there's no enemy, no timer, no XP
// and nothing to lose. Answers still count toward mastery.
// ---------------------------------------------------------------

function startDrill(topicId) {
  drillTopic = topicId;
  drillAsked = 0;
  drillRight = 0;
  campTab = "su-root";  // the camp scene points at Su Root while you drill
  currentZone = null;   // no fight: the game screen shows the camp instead
  enemy.maxHp = 0;
  showPanel("battle-panel");
  setLootMessage(null);
  document.getElementById("skills").hidden = true;
  document.getElementById("mode-label").textContent = "Drill with Su Root: " + topicName(topicId) + " (no timer, no risk, no XP)";
  nextDrillQuestion();
}

function nextDrillQuestion() {
  if (drillAsked >= DRILL_LENGTH) {
    drillAsked = 0;  // "Drill again" starts a new round on the same topic
    drillRight = 0;
  }
  drillAsked++;
  speech = null;
  setLog("Question " + drillAsked + " of " + DRILL_LENGTH + ".");
  document.getElementById("map-button").textContent = "Back to camp";
  document.getElementById("map-button").hidden = true;
  showQuestion(pickQuestion([drillTopic]));
}

// Called by checkAnswer instead of playTurn while drilling.
// rankUp is the new rank's name if this answer reached one, otherwise null.
function finishDrillQuestion(correct, rankUp) {
  if (correct) {
    drillRight++;
  }
  if (rankUp !== null) {
    say(trainerLine("rankUp", { topic: topicName(drillTopic), rank: rankUp }));
  } else {
    say(trainerLine(correct ? "correct" : "wrong"));
  }

  const nextButton = document.getElementById("next-button");
  if (drillAsked < DRILL_LENGTH) {
    setLog("Question " + drillAsked + " of " + DRILL_LENGTH + ": " + (correct ? "right!" : "missed.") +
      " " + drillRight + " right so far.");
    nextButton.textContent = "Next question";
  } else {
    const done = trainerLine("drillDone", { right: drillRight, total: DRILL_LENGTH });
    const rank = masteryRank(drillTopic);
    const next = MASTERY_RANKS[rank];  // undefined once Master
    setLog("Drill complete! " + drillRight + " of " + DRILL_LENGTH + " right. " + topicName(drillTopic) + ": " +
      rankName(rank) + (next ? ", " + (next.correct - topicRecord(drillTopic).right) + " more right answers to " + next.name : "") + ".");
    if (rankUp === null) {
      say(done);
    }
    nextButton.textContent = "Drill again";
  }
  nextButton.hidden = false;
  document.getElementById("map-button").hidden = false;
}

function leaveDrill() {
  drillTopic = null;
  showCamp();
}
