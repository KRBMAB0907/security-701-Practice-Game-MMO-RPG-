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

// Skill damage = base x level bonus x class bonus x gear x skill tree and ascension
//                x favored bonus x weak point x ascension extras.
// forceWeak = true treats the hit as a weak-point hit (the Wildcard Certificate node).
function skillDamage(skill, forceWeak) {
  const playerClass = currentClass();
  let damage = skill.damage * (1 + (save.level - 1) * DAMAGE_PER_LEVEL);
  damage *= playerClass.damageScale;
  damage *= 1 + gearBonus("damage") / 100;  // tool gear, e.g. +15%
  // Skill tree, ascension and topic mastery (see js/mastery.js) add together
  damage *= 1 + (treeBonus("damage") + treeDomainDamage(skill) + ascensionBonus("damage") + masteryBonus(skill)) / 100;
  if (isFavored(skill)) {
    damage *= FAVORED_SKILL_BONUS;
  }
  if (forceWeak || hitsWeakPoint(skill)) {
    // The Insight Lens legendary, the skill tree and ascension add to the class's multiplier
    let multiplier = playerClass.weaknessMultiplier + (hasEffect("insight") ? 0.5 : 0) +
      treeBonus("weakness") + ascensionBonus("weakness");
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
  // Ascension extras (see js/ascension.js)
  if (enemy.boss) {
    damage *= 1 + ascensionBonus("bossDamage") / 100;
  }
  const streak = Math.min(ascFight.streak || 0, STREAK_DAMAGE_MAX_STACKS);
  damage *= 1 + ascensionBonus("streakDamage") * streak / 100;  // right answers in a row
  if (!ascFight.firstHitDone) {
    damage *= 1 + ascensionBonus("firstHitBonus") / 100;
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
  damage *= 1 - (treeBonus("defense") + ascensionBonus("defense")) / 100;  // e.g. Hardening: 3% less per point
  if (hasKeystone("defense-in-depth")) {
    damage *= DEFENSE_IN_DEPTH_TAKEN;
  }
  // Ascension defenses (see js/ascension.js)
  if (enemy.boss) {
    damage *= 1 - ascensionBonus("bossDefense") / 100;
  }
  if (player.hp < player.maxHp / 2) {
    damage *= 1 - ascensionBonus("lowHpDefense") / 100;
  }
  if (ascFight.lastAnswer === "wrong") {
    damage *= 1 - ascensionBonus("defenseAfterWrong") / 100;
  }
  if (ascensionBonus("maxHitPercent") > 0) {
    damage = Math.min(damage, player.maxHp * ascensionBonus("maxHitPercent") / 100);
  }
  return Math.round(damage);
}

// How likely the enemy's attack is to land, from 0 to 1
function enemyHitChance() {
  let chance = currentMode.hitChance + (enemy.boss ? BOSS_HIT_BONUS : 0) + (enemy.accuracy || 0);
  chance -= (treeBonus("dodge") + ascensionBonus("dodge")) / 100;  // e.g. Threat Intel: 2% less per point
  chance -= (ascFight.revokeStacks || 0) / 100;  // the Revocation ascension node
  if (ascFight.lastAnswer === "right") {
    chance -= ascensionBonus("dodgeAfterCorrect") / 100;  // the Correlation ascension node
  }
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
  if (firstClear) {
    message += " +1 Ascension point! Spend it from the Skill tree screen.";
  }
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
  // Later zones get tougher enemies, to keep up with your tree points and gear
  const levelGrowth = 1 + (currentZone.level - 1) * currentMode.enemyHpGrowth;
  enemy.maxHp = Math.round(type.hp * currentMode.enemyHpScale * levelGrowth);
  enemy.hp = enemy.maxHp;

  resetAscensionFight();  // streaks, blocks and once-per-fight saves start over

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
  document.getElementById("map-button").textContent = "Back to map";  // a drill changes it to "Back to camp"

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
  let weakPoint = hitsWeakPoint(currentSkill);
  let extraText = "";

  // Wildcard Certificate ascension node: sometimes any hit counts as a weak point
  if (!weakPoint && Math.random() * 100 < ascensionBonus("wildcard")) {
    weakPoint = true;
    extraText += " Wildcard: it counts as a weak point!";
  }
  let damage = skillDamage(currentSkill, weakPoint);

  // Rapid Response keystone: fast answers hit harder, slow ones softer
  let rapidText = "";
  if (hasKeystone("rapid-response")) {
    const seconds = (Date.now() - questionShownAt) / 1000;
    const fast = seconds <= RAPID_RESPONSE_SECONDS;
    damage = Math.round(damage * (fast ? RAPID_RESPONSE_FAST : RAPID_RESPONSE_SLOW));
    rapidText = fast ? " Rapid Response: a fast answer hits harder!" : " Rapid Response: too slow, the hit is weaker.";
  }

  // Critical hits (Cipher Master ascension): a random chance, or every Nth right answer
  ascFight.rightAnswers++;
  const everyN = ascensionBonus("critEveryN");
  const guaranteed = everyN > 0 && ascFight.rightAnswers % everyN === 0;
  if (guaranteed || Math.random() * 100 < ascensionBonus("critChance")) {
    damage = Math.round(damage * (CRIT_MULTIPLIER + ascensionBonus("critMultiplier")));
    extraText += " Critical hit!";
  }
  hit(enemy, damage, "#00ff9c");

  // Remember this hit for the ascension effects that count up during a fight
  ascFight.firstHitDone = true;
  ascFight.lastHit = damage;
  ascFight.streak++;
  ascFight.lastAnswer = "right";
  ascFight.revokeStacks = Math.min(ascFight.revokeStacks + ascensionBonus("dodgePerHit"), DODGE_PER_HIT_CAP);

  let message = narrate(weakPoint ? "weakHit" : "playerHit", { skill: currentSkill.name, enemy: enemy.name, damage: damage }) + rapidText + extraText;

  // Healing on a right answer: Analysts, skill tree and ascension nodes all add up
  let healing = currentClass().healOnCorrect + treeBonus("heal") + ascensionBonus("heal");
  healing += Math.round(damage * ascensionBonus("lifesteal") / 100);
  if (weakPoint) {
    healing += Math.round(player.maxHp * ascensionBonus("weakHealPercent") / 100);
  }
  if (ascFight.streak % STREAK_HEAL_EVERY === 0) {
    healing += Math.round(player.maxHp * ascensionBonus("streakHeal") / 100);
  }
  const healed = heal(player, healing);
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
  ascFight.streak = 0;  // a miss breaks your streak
  ascFight.lastAnswer = "wrong";
  let message = narrate(timedOut ? "timeout" : "playerMiss", { skill: currentSkill.name, enemy: enemy.name });

  // SOAR Playbook ascension node: a miss still does part of the damage
  const partial = Math.round(skillDamage(currentSkill) * ascensionBonus("missDamage") / 100);
  if (partial > 0) {
    hit(enemy, partial, "#00ff9c");
    message += " Your playbook still deals " + partial + " damage.";
  } else {
    floatingTexts.push({ value: "MISS", x: enemy.x + 8, y: enemy.y - 34, color: "#a8d5c0", life: 900, maxLife: 900 });
  }

  // Lessons Learned ascension node: a wrong answer heals a little
  const healed = heal(player, ascensionBonus("healOnWrong"));
  if (healed > 0) {
    message += " You recover " + healed + " health.";
  }
  return message;
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
    return narrate("enemyMiss", { enemy: enemy.name }) + enemyMissedEffects();
  }

  // Blocking ascension nodes (Preventive Control, Air Gap): the first hits do nothing
  if (ascFight.blocksLeft > 0) {
    ascFight.blocksLeft--;
    floatingTexts.push({ value: "BLOCKED", x: player.x + 8, y: player.y - 34, color: "#4fc3f7", life: 900, maxLife: 900 });
    return "The " + enemy.name + "'s attack is blocked!";
  }

  let damage = enemyDamage();
  let failoverText = "";

  // Fail-Safe and Key Escrow ascension nodes: once per fight, survive at 1 health.
  // This comes before the Failover Core, so with both you can survive twice.
  if (damage >= player.hp && ascensionBonus("cheatDeath") > 0 && !ascFight.cheatDeathUsed) {
    damage = player.hp - 1;
    ascFight.cheatDeathUsed = true;
    failoverText = " Your fail-safe kicks in and keeps you standing with 1 health!";
  }

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
  return narrate("enemyHit", { enemy: enemy.name, damage: damage }) + failoverText + enemyHitEffects(damage);
}

// Ascension effects when an enemy misses you. Returns extra log text.
function enemyMissedEffects() {
  let text = "";
  // Countermeasure: strike back for part of your last hit
  const counter = Math.round(ascFight.lastHit * ascensionBonus("counterOnMiss") / 100);
  if (counter > 0) {
    hit(enemy, counter, "#00ff9c");
    text += " You counter for " + counter + "!";
  }
  // Next-Gen Firewall: heal when an attack misses
  const healed = heal(player, Math.round(player.maxHp * ascensionBonus("enemyMissHeal") / 100));
  if (healed > 0) {
    text += " You recover " + healed + " health.";
  }
  return text;
}

// Ascension effects after an enemy hits you. Returns extra log text.
function enemyHitEffects(damage) {
  let text = "";
  // Stateful Inspection: the attacker takes part of the damage back
  const thorns = Math.round(damage * ascensionBonus("thorns") / 100);
  if (thorns > 0) {
    hit(enemy, thorns, "#00ff9c");
    text += " The " + enemy.name + " takes " + thorns + " back.";
  }
  // Disk Image: once per fight, a big heal when your health gets low
  const low = player.hp > 0 && player.hp < player.maxHp * EMERGENCY_HEAL_BELOW;
  if (low && ascensionBonus("emergencyHeal") > 0 && !ascFight.emergencyHealUsed) {
    ascFight.emergencyHealUsed = true;
    heal(player, Math.round(player.maxHp * EMERGENCY_HEAL_TO) - player.hp);
    text += " Emergency restore: you're back to " + player.hp + " health!";
  }
  return text;
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

// XP for beating the current enemy, with skill tree and ascension bonuses
function xpReward() {
  let xp = enemy.xp * (1 + (treeBonus("xp") + ascensionBonus("xp")) / 100);
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
  if (drillTopic !== null) {
    nextDrillQuestion();  // drilling with Su Root, not fighting (see js/mastery.js)
  } else if (fightOver) {
    if (fightWon) {
      enemyIndex++;  // move on to the next enemy
    }
    startFight();    // after a loss, the same enemy again
  } else {
    setLog("Your turn. Choose a skill.");
    showSkillChoice();
  }
});

// During a drill this button says "Back to camp" instead
document.getElementById("map-button").addEventListener("click", () => {
  if (drillTopic !== null) {
    leaveDrill();
  } else {
    showMap();
  }
});
