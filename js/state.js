// Game state: data loaded from files, saved progress,
// the current fight, and the two fighters.

// Loaded from the data files
let topicNames = {};  // topic id -> readable name, built from topics.json
let questions = [];
let skills = [];
let enemyTypes = [];
let zones = [];
let classes = [];

// A brand-new save: also used by "Reset progress"
function newSave() {
  return {
    level: 1, xp: 0, clearedZones: [], classId: null,
    inventory: [], equipped: { tool: null, armor: null, module: null }, nextItemId: 1
  };
}

// Saved progress (kept in the browser between visits)
let save = newSave();

// Current game state
let currentMode = null;
let currentZone = null;
let enemyIndex = 0;       // which enemy in the zone we're fighting
let currentSkill = null;
let recentQuestionIds = [];  // the last few questions asked, to avoid repeats
let fightOver = false;
let fightWon = false;
let timerId = null;
let timeLeft = 0;
let questionTime = 0;     // full time for the current question, including gear bonus
let failoverUsed = false; // the Failover Core legendary works once per fight

// The two fighters. flash and shake count down in milliseconds.
const player = { name: "You", hp: 100, maxHp: 100, x: 48,  y: 112, color: "#00ff9c", flash: 0, shake: 0 };
const enemy  = { name: "",    hp: 0,   maxHp: 0,   x: 256, y: 112, color: "#ff3864", flash: 0, shake: 0 };

// Damage numbers that float up and fade out
let floatingTexts = [];
