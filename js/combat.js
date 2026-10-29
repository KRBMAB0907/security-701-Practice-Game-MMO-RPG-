// Combat: skills, weaknesses, damage, and winning or losing fights.

// Readable topic name, e.g. "control-types" -> "Control types"
function topicName(topicId) {
  return topicNames[topicId] || topicId;
}

// Bosses change weakness as they lose health. Their health bar is split
// evenly into phases: 2 phases switch at half health, 4 phases switch
// at 75%, 50% and 25%, and so on.
function currentPhase() {
  const damageTaken = 1 - enemy.hp / enemy.maxHp;  // 0 at full health, 1 when defeated
  const phase = Math.floor(damageTaken * enemy.phases.length);
  return Math.min(phase, enemy.phases.length - 1);  // stay on the last phase at 0 health
}

function currentWeakness() {
  if (enemy.phases) {
    return enemy.phases[currentPhase()];
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

// Skill damage = base x level bonus x class bonus x gear x skill tree x favored bonus x weak point
function skillDamage(skill) {
  const playerClass = currentClass();
  let damage = skill.damage * (1 + (save.level - 1) * DAMAGE_PER_LEVEL);
  damage *= playerClass.damageScale;
  damage *= 1 + gearBonus("damage") / 100;  // tool gear, e.g. +15%
  damage *= 1 + (treeBonus("damage") + treeDomainDamage(skill)) / 100;  // skill tree
  if (isFavored(skill)) {
    damage *= FAVORED_SKILL_BONUS;
  }
  if (hitsWeakPoint(skill)) {
    // The Insight Lens legendary and the skill tree add to the class's multiplier
    let multiplier = playerClass.weaknessMultiplier + (hasEffect("insight") ? 0.5 : 0) + treeBonus("weakness");
    if (hasKeystone("zero-trust")) {
      multiplier += ZERO_TRUST_WEAK_BONUS;
    }
    damage *= multiplier;
  } else if (hasKeystone("zero-trust")) {
    damage *= ZERO_TRUST_OTHER_SCALE;  // Zero Trust's downside: weak points only
  }
  if (hasKeystone("assume-breach")) {
    damage *= ASSUME_BREACH_DAMAGE;
  }
  if (hasKeystone("defense-in-depth")) {
    damage *= DEFENSE_IN_DEPTH_DAMAGE;
  }
  return Math.round(damage);
}

// Enemy damage = mode damage x zone level scale x boss multiplier x your class's defense x skill tree
// Enemies get stronger with the zone's level, a bit slower than your base
// health (ENEMY_DAMAGE_GROWTH). An average player dies in about 7 hits from a
// normal enemy early on (Learner) and about 9 late, when fights are longer.
// Being above the zone's level still helps, since you have more health than
// the zone expects. Try numbers with tests/damage_calc.py.
function enemyDamage() {
  const zoneHp = currentMode.playerHp + (currentZone.level - 1) * HP_PER_LEVEL;
  const healthGrowth = zoneHp / currentMode.playerHp - 1;  // 0 at level 1
  const levelScale = 1 + healthGrowth * ENEMY_DAMAGE_GROWTH;
  let damage = currentMode.enemyDamage * levelScale * (enemy.damageScale || 1) * currentClass().damageTakenScale;
  damage *= 1 - treeBonus("defense") / 100;  // e.g. Hardening: 3% less per point
  if (hasKeystone("defense-in-depth")) {
    damage *= DEFENSE_IN_DEPTH_TAKEN;
  }
  return Math.round(damage);
}

// How likely the enemy's attack is to land, from 0 to 1
function enemyHitChance() {
  let chance = currentMode.hitChance + (enemy.boss ? BOSS_HIT_BONUS : 0) + (enemy.accuracy || 0);
  chance -= treeBonus("dodge") / 100;  // e.g. Threat Intel: 2% less per point
  if (hasKeystone("accept-the-risk")) {
    chance += ACCEPT_RISK_HIT;
  }
  return Math.max(Math.min(chance, MAX_HIT_CHANCE), 0);
}

// What to say after clearing a zone's last enemy.
// firstClear is true the first time, so the final boss bonus is only announced once.
function clearedZoneMessage(area, firstClear) {
  const isFinale = area.zones.indexOf(currentZone) === area.zones.length - 1;
  if (!isFinale) {
    return " The next sub-zone is unlocked.";
  }
  let message = " " + area.name.toUpperCase() + " IS COMPLETE! You have mastered Domain " +
    area.domain + ": " + domainNames[area.domain] + ".";
  const nextArea = areas[areas.indexOf(area) + 1];
  if (nextArea !== undefined) {
    if (isAreaBuilt(nextArea)) {
      message += " " + nextArea.name + " is now unlocked!";
      selectedArea = nextArea;  // the map opens on the new area next time
    } else {
      message += " " + nextArea.name + " is coming soon.";
    }
  } else {
    // The last area: the whole game is complete
    message += " YOU HAVE CONQUERED ALL FIVE DOMAINS OF SECURITY+! Replay any zone on Hard mode to sharpen your weak spots, and good luck on the exam!";
    if (firstClear) {
      message += " You earned " + FINAL_BOSS_TREE_POINTS + " bonus skill tree points!";
    }
  }
  return message;
}

function heal(fighter, amount) {
  const healed = Math.min(amount, fighter.maxHp - fighter.hp);
  if (healed > 0) {
    fighter.hp += healed;
    floatingTexts.push({ value: "+" + healed, x: fighter.x + 8, y: fighter.y - 44, color: "#4fc3f7", life: 900, maxLife: 900 });
  }
  return healed;
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
  enemy.spritePath = type.sprite ? enemySpritePath(type.sprite) : null;  // null = draw a square
  enemy.boss = type.boss || false;
  enemy.weakness = type.weakness;
  enemy.phases = type.phases;
  enemy.damageScale = type.damageScale;
  enemy.xp = type.xp;
  enemy.accuracy = type.accuracy || 0;  // optional per-enemy hit chance bonus in the data
  enemy.maxHp = Math.round(type.hp * currentMode.enemyHpScale);
  enemy.hp = enemy.maxHp;

  // You start every fight at full health, in your class's colors
  player.name = currentClass().name;
  player.color = currentClass().color;
  player.spritePath = classSpritePath(currentClass().id);
  player.maxHp = playerMaxHp();
  player.hp = player.maxHp;
  if (hasKeystone("assume-breach")) {
    player.hp = Math.round(player.maxHp * ASSUME_BREACH_START_HP);  // the keystone's downside
  }

  fightOver = false;
  fightWon = false;
  failoverUsed = false;
  turnInProgress = false;
  floatingTexts = [];
  setLootMessage(null);
  document.getElementById("mode-label").textContent = "Mode: " + currentMode.label;

  const intro = enemy.boss ? "BOSS: " + enemy.name + " blocks the way!" : "A " + enemy.name + " appears!";
  const hitPercent = Math.round(enemyHitChance() * 100);
  setLog(intro + " Weak to " + topicName(currentWeakness()) + ". It hits " + hitPercent + "% of the time.");
  enemyTaunt("intro");
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
    button.textContent = skill.name + " (" + skillDamage(skill) + " damage)"
      + (isFavored(skill) ? " [class skill]" : "")
      + (weakPoint ? " - WEAK POINT!" : "");
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

// Your turn after a correct answer. Returns what happened, for the log.
function playerAttacks() {
  const weaknessBefore = currentWeakness();
  const weakPoint = hitsWeakPoint(currentSkill);
  let damage = skillDamage(currentSkill);

  // Rapid Response keystone: fast answers hit harder, slow ones softer
  let rapidText = "";
  if (hasKeystone("rapid-response")) {
    const seconds = (Date.now() - questionShownAt) / 1000;
    const fast = seconds <= RAPID_RESPONSE_SECONDS;
    damage = Math.round(damage * (fast ? RAPID_RESPONSE_FAST : RAPID_RESPONSE_SLOW));
    rapidText = fast ? " Rapid Response: a fast answer hits harder!" : " Rapid Response: too slow, the hit is weaker.";
  }
  hit(enemy, damage, "#00ff9c");

  let message = narrate(weakPoint ? "weakHit" : "playerHit", { skill: currentSkill.name, enemy: enemy.name, damage: damage }) + rapidText;

  // Analysts (and skill tree healing nodes) heal a little with every correct answer
  const healed = heal(player, currentClass().healOnCorrect + treeBonus("heal"));
  if (healed > 0) {
    message += " You recover " + healed + " health.";
  }

  if (enemy.hp > 0 && currentWeakness() !== weaknessBefore) {
    message += " The " + enemy.name + " shifts! Now weak to " + topicName(currentWeakness()) + ".";
    enemyTaunt("phase");
  }
  return message;
}

// Your turn after a wrong answer or running out of time
function playerMisses(timedOut) {
  floatingTexts.push({ value: "MISS", x: enemy.x + 8, y: enemy.y - 34, color: "#a8d5c0", life: 900, maxLife: 900 });
  return narrate(timedOut ? "timeout" : "playerMiss", { skill: currentSkill.name, enemy: enemy.name });
}

// The enemy's turn: it attacks every turn, and its hit chance decides
// whether the attack lands. Returns what happened, for the log.
function enemyAttacks() {
  enemy.lunge = LUNGE_MS;

  if (Math.random() >= enemyHitChance()) {
    player.dodge = DODGE_MS;
    floatingTexts.push({ value: "MISS", x: player.x + 8, y: player.y - 34, color: "#a8d5c0", life: 900, maxLife: 900 });
    if (Math.random() < 0.4) {
      enemyTaunt("miss");
    }
    return narrate("enemyMiss", { enemy: enemy.name });
  }

  let damage = enemyDamage();
  let failoverText = "";

  // Failover Core legendary: once per fight, a lethal hit leaves you at 1 health
  if (damage >= player.hp && hasEffect("failover") && !failoverUsed) {
    damage = player.hp - 1;
    failoverUsed = true;
    failoverText = " Your Failover Core kicks in and keeps you standing with 1 health!";
  }

  hit(player, damage, "#ff3864");
  if (Math.random() < 0.5) {
    enemyTaunt("hit");
  }
  return narrate("enemyHit", { enemy: enemy.name, damage: damage }) + failoverText;
}

// After the whole turn: did someone win, or does the fight go on?
function finishTurn() {
  turnInProgress = false;
  if (enemy.hp <= 0) {
    winFight();
  } else if (player.hp <= 0) {
    loseFight();
  } else {
    const nextButton = document.getElementById("next-button");
    nextButton.textContent = "Continue";
    nextButton.hidden = false;
  }
}

// One full turn: your attack (or miss) right away, then after a short
// pause the enemy's attack, so the exchange reads like a real fight.
function playTurn(correct, timedOut) {
  turnInProgress = true;
  floatingTexts = [];  // clear last turn's numbers, so an old "MISS" can't linger on the win screen
  const yourTurn = correct ? playerAttacks() : playerMisses(timedOut);
  setLog(yourTurn);

  if (enemy.hp <= 0) {
    finishTurn();  // the enemy is defeated, so it doesn't get to attack
    return;
  }
  setTimeout(() => {
    setLog(yourTurn + " " + enemyAttacks());
    finishTurn();
  }, ENEMY_TURN_DELAY_MS);
}

// Shows what dropped: its icon, its stats compared with what you have
// equipped, and an "Equip now" button. Pass null to clear it.
function setLootMessage(drop) {
  const box = document.getElementById("loot-message");
  box.innerHTML = "";
  if (drop === null) {
    return;
  }
  const item = drop.item;
  const tier = tierById(item.tier);
  box.appendChild(makeIconCanvas(item, 40));

  const info = document.createElement("div");
  const title = document.createElement("strong");
  // Legendary names don't include the tier ("Failover Core"), so add it
  title.textContent = "LOOT: " + (item.tier === "legendary" ? "Legendary " + item.name : item.name);
  title.style.color = tier.color;
  info.appendChild(title);

  const details = document.createElement("small");
  if (!drop.kept) {
    details.textContent = "Your gear bag is full, so it was left behind. Discard something on the Gear screen.";
  } else {
    const current = findItem(save.equipped[item.slot]);
    details.textContent = describeStat(item) + " · requires level " + item.level + " · " +
      (current ? "you have: " + current.name + " (" + describeStat(current) + ")" : "your " + slotById(item.slot).name + " slot is empty");
  }
  info.appendChild(details);

  if (drop.kept) {
    const button = document.createElement("button");
    if (item.level > save.level) {
      button.textContent = "Reach level " + item.level + " to equip";
      button.disabled = true;
    } else {
      button.textContent = "Equip now";
      button.addEventListener("click", () => {
        equipItem(item);
        button.textContent = "Equipped!";
        button.disabled = true;
        details.textContent = describeStat(item) + " · equipped";
      });
    }
    info.appendChild(button);
  }
  box.appendChild(info);
}

// XP for beating the current enemy, with skill tree bonuses
function xpReward() {
  let xp = enemy.xp * (1 + treeBonus("xp") / 100);
  if (hasKeystone("accept-the-risk")) {
    xp *= ACCEPT_RISK_XP;
  }
  return Math.round(xp);
}

function winFight() {
  fightOver = true;
  fightWon = true;
  speech = null;  // a defeated enemy stops talking
  const xp = xpReward();
  const levelUp = gainXp(xp);
  const drop = rollDrop();
  if (drop !== null) {
    setLootMessage(drop);
  }
  const isLastEnemy = enemyIndex === currentZone.enemies.length - 1;
  const nextButton = document.getElementById("next-button");

  if (isLastEnemy) {
    const firstClear = !save.clearedZones.includes(currentZone.id);
    if (firstClear) {
      save.clearedZones.push(currentZone.id);
      writeSave();
    }
    const unlockText = clearedZoneMessage(areaOf(currentZone), firstClear);
    setLog(currentZone.name + " cleared! +" + xp + " XP." + levelUp + unlockText);
    nextButton.hidden = true;
  } else {
    setLog("Victory! +" + xp + " XP." + levelUp);
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
