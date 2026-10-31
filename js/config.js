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
//   enemyHpGrowth extra enemy health per zone level above 1 (0.02 = +2%,
//                so +64% by the final zone). It makes up for the skill tree
//                and gear, which make you much stronger late in the game.
//                Fun leaves it at 0 so it stays relaxed.
// ---------------------------------------------------------------
const MODES = {
  fun:     { label: "Fun",     time: null, playerHp: 100, enemyHpScale: 0.75, enemyDamage: 13, hitChance: 0.5,  enemyHpGrowth: 0 },
  learner: { label: "Learner", time: 60,   playerHp: 100, enemyHpScale: 1,    enemyDamage: 15, hitChance: 0.65, enemyHpGrowth: 0.02 },
  hard:    { label: "Hard",    time: 30,   playerHp: 80,  enemyHpScale: 1,    enemyDamage: 14, hitChance: 0.75, enemyHpGrowth: 0.02 }
};

// ---------------------------------------------------------------
// Balance settings: the numbers to tweak if the game feels off.
// ---------------------------------------------------------------
const LOW_TIME_WARNING = 10;      // seconds left when the timer bar turns red
const WEAKNESS_MULTIPLIER = 1.5;  // damage bonus for hitting a weak point
const DAMAGE_PER_LEVEL = 0.1;     // +10% skill damage per level above 1
const HP_PER_LEVEL = 10;          // extra max health per level
const ENEMY_DAMAGE_GROWTH = 0.7;  // enemy damage grows 70% as fast as your health,
                                  // so late areas (longer fights) take more hits
const XP_PER_LEVEL = 50;          // level N needs N x 50 XP to level up
const DEATH_XP_LOSS = 0.25;       // dying costs 25% of the current XP bar
const RECENT_QUESTION_MEMORY = 6; // how many recent questions to avoid repeating
const FAVORED_SKILL_BONUS = 1.2;  // +20% damage for skills your class favors
const CLASS_SWITCH_LEVEL_LOSS = 0.2; // switching class costs 20% of your levels
const BOSS_HIT_BONUS = 0.1;       // bosses hit 10% more often
const MAX_HIT_CHANCE = 0.95;      // no enemy is a sure thing
const ENEMY_TURN_DELAY_MS = 650;  // pause between your attack and the enemy's
const SAVE_KEY = "secplus-rpg-save";

// Gear (tiers and base stats are in data/loot.json)
const LEVEL_STAT_BONUS = 0.05;    // each item level above 1 adds 5% to its stat
                                  // (it was 10%, which made late gear too strong)
const MAX_EXTRA_TIME = 0.5;       // gear and the skill tree can add at most +50%
                                  // of the mode's time (Learner 60s -> 90s max)

// Skill tree (the nodes themselves are in data/skilltree.json)
const FINAL_BOSS_TREE_POINTS = 3;     // bonus points for beating the final boss

// Ascension (the boards and their node numbers are in data/ascension.json)
const CRIT_MULTIPLIER = 2;          // critical hits deal double damage
const STREAK_HEAL_EVERY = 3;        // streakHeal triggers every 3 right answers in a row
const STREAK_DAMAGE_MAX_STACKS = 5; // streakDamage counts at most 5 answers (e.g. 5 x 8% = +40%)
const DODGE_PER_HIT_CAP = 10;       // dodgePerHit can lower enemy hit chance by at most 10%
const EMERGENCY_HEAL_BELOW = 0.3;   // emergencyHeal triggers below 30% health...
const EMERGENCY_HEAL_TO = 0.6;      // ...and heals you back up to 60%

// Topic mastery and Su Root's drills (see js/mastery.js). Every right
// answer on a topic counts toward its rank. Kept small on purpose: studying
// should help, but levels, gear and the tree are still the main power.
const MASTERY_RANKS = [
  { name: "Novice",       correct: 5 },
  { name: "Practitioner", correct: 15 },
  { name: "Expert",       correct: 30 },
  { name: "Master",       correct: 50 }
];
const MASTERY_DAMAGE_PER_RANK = 2; // +2% damage per rank with skills on that topic (Master = +8%)
const DRILL_LENGTH = 5;            // questions in one drill with Su Root
const NEEDS_WORK_MIN_ANSWERS = 3;  // a topic needs this many answers before Su Root judges it
const NEEDS_WORK_COUNT = 5;        // how many weak topics the "Needs work" list shows

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
