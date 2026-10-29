// Settings: difficulty modes and balance numbers.
// Tweak these to change how the game feels.

// ---------------------------------------------------------------
// Difficulty modes: every mode setting lives here, in one place.
//   time         seconds per question (null = no timer)
//   playerHp     your starting health at level 1
//   enemyHpScale multiplies every enemy's health (0.75 = 25% less)
//   enemyDamage  how hard a normal enemy hits at level 1 (it grows with the
//                zone's level, see enemyDamage() in js/combat.js)
//   hitChance    how often an enemy's attack lands (0.65 = 65%)
// ---------------------------------------------------------------
const MODES = {
  fun:     { label: "Fun",     time: null, playerHp: 100, enemyHpScale: 0.75, enemyDamage: 13, hitChance: 0.5 },
  learner: { label: "Learner", time: 60,   playerHp: 100, enemyHpScale: 1,    enemyDamage: 15, hitChance: 0.65 },
  hard:    { label: "Hard",    time: 30,   playerHp: 80,  enemyHpScale: 1,    enemyDamage: 14, hitChance: 0.75 }
};

// ---------------------------------------------------------------
// Balance settings: the numbers to tweak if the game feels off.
// ---------------------------------------------------------------
const LOW_TIME_WARNING = 10;      // seconds left when the timer bar turns red
const WEAKNESS_MULTIPLIER = 1.5;  // damage bonus for hitting a weak point
const DAMAGE_PER_LEVEL = 0.1;     // +10% skill damage per level above 1
const HP_PER_LEVEL = 10;          // extra max health per level
const XP_PER_LEVEL = 50;          // level N needs N x 50 XP to level up
const DEATH_XP_LOSS = 0.25;       // dying costs 25% of the current XP bar
const RECENT_QUESTION_MEMORY = 6; // how many recent questions to avoid repeating
const FAVORED_SKILL_BONUS = 1.2;  // +20% damage for skills your class favors
const CLASS_SWITCH_LEVEL_LOSS = 0.2; // switching class costs 20% of your levels
const BOSS_HIT_BONUS = 0.1;       // bosses hit 10% more often
const MAX_HIT_CHANCE = 0.95;      // no enemy is a sure thing
const ENEMY_TURN_DELAY_MS = 650;  // pause between your attack and the enemy's
const SAVE_KEY = "secplus-rpg-save";

// Skill tree (the nodes themselves are in data/skilltree.json)
const FINAL_BOSS_TREE_POINTS = 3;     // bonus points for beating the final boss

// Keystones: each one is strong but has a downside
const ZERO_TRUST_WEAK_BONUS = 0.5;    // Zero Trust: weak points take +0.5x...
const ZERO_TRUST_OTHER_SCALE = 0.6;   // ...but every other hit deals 40% less
const ASSUME_BREACH_START_HP = 0.7;   // Assume Breach: start fights at 70% health...
const ASSUME_BREACH_DAMAGE = 1.3;     // ...but deal 30% more damage
const DEFENSE_IN_DEPTH_TAKEN = 0.7;   // Defense in Depth: take 30% less damage...
const DEFENSE_IN_DEPTH_DAMAGE = 0.85; // ...but deal 15% less
const RAPID_RESPONSE_SECONDS = 20;    // Rapid Response: answer within 20 seconds...
const RAPID_RESPONSE_FAST = 1.4;      // ...for +40% damage...
const RAPID_RESPONSE_SLOW = 0.8;      // ...or deal 20% less when slower
const ACCEPT_RISK_XP = 1.4;           // Accept the Risk: +40% XP...
const ACCEPT_RISK_LOOT = 0.15;        // ...and +15% gear drop chance...
const ACCEPT_RISK_HIT = 0.1;          // ...but enemies hit 10% more often

// Animation timings (milliseconds)
const FLASH_MS = 150;
const SHAKE_MS = 300;
const LUNGE_MS = 300;  // enemy jumps toward you when it attacks
const DODGE_MS = 350;  // you hop back when an attack misses
