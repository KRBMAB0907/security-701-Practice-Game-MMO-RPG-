// Combat: skills, weaknesses, damage, and winning or losing fights.

// Readable topic name, e.g. "control-types" -> "Control types"
function topicName(topicId) {
  return topicNames[topicId] || topicId;
}

// Bosses change weakness at half health (their "phases")
function currentWeakness() {
  if (enemy.phases) {
    return enemy.hp > enemy.maxHp / 2 ? enemy.phases[0] : enemy.phases[1];
  }
  return enemy.weakness;
}

// True if this skill uses the topic the enemy is currently weak to
function hitsWeakPoint(skill) {
  return skill.topics.includes(currentWeakness());
}

// Only the skills this zone allows (all skills if the zone lists none)
function zoneSkills() {
  if (!currentZone.skills || currentZone.skills.length === 0) {
    return skills;
  }
  return skills.filter(skill => currentZone.skills.includes(skill.id));
}

function skillDamage(skill) {
  let damage = skill.damage * (1 + (save.level - 1) * DAMAGE_PER_LEVEL);
  if (hitsWeakPoint(skill)) {
    damage *= WEAKNESS_MULTIPLIER;
  }
  return Math.round(damage);
}

function enemyDamage() {
  return Math.round(currentMode.enemyDamage * (enemy.damageScale || 1));
}

function hit(fighter, amount, color) {
  fighter.hp = Math.max(fighter.hp - amount, 0);
  fighter.flash = FLASH_MS;
  fighter.shake = SHAKE_MS;
  floatingTexts.push({ value: "-" + amount, x: fighter.x + 8, y: fighter.y - 34, color: color, life: 900, maxLife: 900 });
}

function startFight() {
  const enemyId = currentZone.enemies[enemyIndex];
  const type = enemyTypes.find(e => e.id === enemyId);

  enemy.name = type.name;
  enemy.color = type.color;
  enemy.boss = type.boss || false;
  enemy.weakness = type.weakness;
  enemy.phases = type.phases;
  enemy.damageScale = type.damageScale;
  enemy.xp = type.xp;
  enemy.maxHp = Math.round(type.hp * currentMode.enemyHpScale);
  enemy.hp = enemy.maxHp;

  // You start every fight at full health
  player.maxHp = playerMaxHp();
  player.hp = player.maxHp;

  fightOver = false;
  fightWon = false;
  floatingTexts = [];
  document.getElementById("mode-label").textContent = "Mode: " + currentMode.label;

  const intro = enemy.boss ? "BOSS: " + enemy.name + " blocks the way!" : "A " + enemy.name + " appears!";
  setLog(intro + " Weak to " + topicName(currentWeakness()) + ".");
  showSkillChoice();
}

function setLog(message) {
  document.getElementById("battle-log").textContent = message;
}

function showSkillChoice() {
  document.getElementById("question-area").hidden = true;
  document.getElementById("next-button").hidden = true;
  document.getElementById("map-button").hidden = true;

  const skillsDiv = document.getElementById("skills");
  skillsDiv.innerHTML = "";
  skillsDiv.hidden = false;

  zoneSkills().forEach(skill => {
    const button = document.createElement("button");
    const weakPoint = hitsWeakPoint(skill);
    button.textContent = skill.name + " (" + skillDamage(skill) + " damage)" + (weakPoint ? " - WEAK POINT!" : "");
    button.classList.toggle("weak-point", weakPoint);

    const details = document.createElement("small");
    details.textContent = skill.description;
    button.appendChild(details);

    button.addEventListener("click", () => useSkill(skill));
    skillsDiv.appendChild(button);
  });
}

function useSkill(skill) {
  currentSkill = skill;
  document.getElementById("skills").hidden = true;
  setLog("You ready " + skill.name + "...");
  showQuestion(pickQuestion(skill.topics));
}

// A random question on any of the skill's topics, preferring ones the
// player hasn't seen recently so small topics don't repeat back to back
function pickQuestion(topics) {
  const matching = questions.filter(q => topics.includes(q.topic));
  let pool = matching.filter(q => !recentQuestionIds.includes(q.id));
  if (pool.length === 0) {
    pool = matching;  // every one was seen recently, so allow repeats
  }
  const question = pool[Math.floor(Math.random() * pool.length)];

  recentQuestionIds.push(question.id);
  if (recentQuestionIds.length > RECENT_QUESTION_MEMORY) {
    recentQuestionIds.shift();  // forget the oldest
  }
  return question;
}

// Called after a correct answer
function playerAttacks() {
  const weaknessBefore = currentWeakness();
  const damage = skillDamage(currentSkill);
  hit(enemy, damage, "#00ff9c");

  let message = currentSkill.name + " hits for " + damage + " damage!";
  if (enemy.hp > 0 && currentWeakness() !== weaknessBefore) {
    message += " The " + enemy.name + " shifts! Now weak to " + topicName(currentWeakness()) + ".";
  }
  setLog(message);
}

// Called after a wrong answer or timeout
function enemyAttacks() {
  const damage = enemyDamage();
  hit(player, damage, "#ff3864");
  setLog(currentSkill.name + " fizzles! The " + enemy.name + " hits you for " + damage + ".");
}

function winFight() {
  fightOver = true;
  fightWon = true;
  const levelUp = gainXp(enemy.xp);
  const isLastEnemy = enemyIndex === currentZone.enemies.length - 1;
  const nextButton = document.getElementById("next-button");

  if (isLastEnemy) {
    if (!save.clearedZones.includes(currentZone.id)) {
      save.clearedZones.push(currentZone.id);
      writeSave();
    }
    setLog(currentZone.name + " cleared! +" + enemy.xp + " XP." + levelUp + " The next sub-zone is unlocked.");
    nextButton.hidden = true;
  } else {
    setLog("Victory! +" + enemy.xp + " XP." + levelUp);
    nextButton.textContent = "Next enemy";
    nextButton.hidden = false;
  }
  document.getElementById("map-button").hidden = false;
}

function loseFight() {
  fightOver = true;
  fightWon = false;
  const lost = loseXp();
  setLog("Defeated! You lost " + lost + " XP. Review the explanation and try again.");

  const nextButton = document.getElementById("next-button");
  nextButton.textContent = "Try again";
  nextButton.hidden = false;
  document.getElementById("map-button").hidden = false;
}

document.getElementById("next-button").addEventListener("click", () => {
  if (fightOver) {
    if (fightWon) {
      enemyIndex++;  // move on to the next enemy
    }
    startFight();    // after a loss, the same enemy again
  } else {
    setLog("Your turn. Choose a skill.");
    showSkillChoice();
  }
});

document.getElementById("map-button").addEventListener("click", showMap);
