"""Damage calculator: how many enemy hits it takes to kill you, in every zone.

No browser needed: it reads the game data and does the same math as the game,
so you can try out balance numbers in seconds before changing the game.

It assumes the "average player": an Analyst with no armor, at the zone's level.
For each zone it prints hits to die against a normal enemy, a sub-boss and the
area's finale boss. It also estimates whether you can win before you run out of
health: "turns you survive" (hits / enemy hit chance) against "turns to win"
(correct answers needed / your accuracy).

Run from anywhere:
    python tests/damage_calc.py           # summary per area
    python tests/damage_calc.py --full    # every zone
    python tests/damage_calc.py --old     # the formula before the level scaling
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------
# Numbers to try out (they match the game now). Change, run, compare.
# ---------------------------------------------------------------
# Same fields as MODES in js/config.js
MODES = {
    "fun":     {"playerHp": 100, "enemyHpScale": 0.75, "enemyDamage": 13, "hitChance": 0.5},
    "learner": {"playerHp": 100, "enemyHpScale": 1,    "enemyDamage": 15, "hitChance": 0.65},
    "hard":    {"playerHp": 80,  "enemyHpScale": 1,    "enemyDamage": 14, "hitChance": 0.75},
}
SUB_BOSS_DAMAGE = 1.2  # "damageScale" of bosses in data/areas/*.json
FINALE_DAMAGE = 1.15   # "damageScale" of each area's last boss

# The old numbers, before enemy damage grew with zone level, for --old
OLD_MODES = {
    "fun":     {"playerHp": 100, "enemyHpScale": 0.75, "enemyDamage": 6,  "hitChance": 0.5},
    "learner": {"playerHp": 100, "enemyHpScale": 1,    "enemyDamage": 9,  "hitChance": 0.65},
    "hard":    {"playerHp": 80,  "enemyHpScale": 1,    "enemyDamage": 13, "hitChance": 0.75},
}

# Targets: hits to die (normal, sub-boss, finale)
TARGETS = {
    "fun":     {"normal": (8, 8), "sub-boss": (6, 7), "finale": (7, 7)},
    "learner": {"normal": (7, 7), "sub-boss": (6, 6), "finale": (6, 6)},
    "hard":    {"normal": (6, 6), "sub-boss": (5, 5), "finale": (5, 5)},
}

# Fixed game constants (js/config.js)
HP_PER_LEVEL = 10
DAMAGE_PER_LEVEL = 0.1
BOSS_HIT_BONUS = 0.1
MAX_HIT_CHANCE = 0.95
ACCURACY = 0.65  # how often the simulated player answers right


def load(path):
    with open(os.path.join(ROOT, path)) as f:
        return json.load(f)


def player_hp(mode, level):
    # Same as playerMaxHp() in js/leveling.js, for an Analyst (hpScale 1) with no armor
    return mode["playerHp"] + (level - 1) * HP_PER_LEVEL


# Old per-area steps (they used to be "enemyDamageScale" in data/areas.json)
OLD_AREA_SCALE = {"foundry": 1, "breach-wastes": 1.3, "citadel": 1.9, "operations-deep": 2.4, "council-spire": 2.9}
OLD_BOSS_SCALE = {"normal": 1, "sub-boss": 1.5, "finale": 1.75}


def enemy_damage_old(mode, area, kind):
    # The old enemyDamage(): a fixed step per area
    return round(mode["enemyDamage"] * OLD_AREA_SCALE[area["id"]] * OLD_BOSS_SCALE[kind])


def enemy_damage_new(mode, zone_level, kind):
    # Same as enemyDamage() in js/combat.js: enemy damage grows with the zone's
    # level at the same pace as your base health, so hits to die stay the same
    level_scale = player_hp(mode, zone_level) / mode["playerHp"]
    boss_scale = {"normal": 1, "sub-boss": SUB_BOSS_DAMAGE, "finale": FINALE_DAMAGE}[kind]
    return round(mode["enemyDamage"] * level_scale * boss_scale)


def kind_of(enemy, finale_id):
    if enemy["id"] == finale_id:
        return "finale"
    return "sub-boss" if enemy.get("boss") else "normal"


def main():
    old = "--old" in sys.argv
    full = "--full" in sys.argv
    modes = OLD_MODES if old else MODES
    print("Formula:", "OLD (fixed step per area)" if old else "NEW (grows with zone level)")
    print("Average player: Analyst, no armor, at the zone's level, %d%% accuracy" % (ACCURACY * 100))
    print("Each cell: hits to die  [turns you survive / turns to win]  * = outside target\n")

    for mode_id, mode in modes.items():
        print("=== %s ===" % mode_id.upper())
        for area in load("data/areas.json")["areas"]:
            data = load(area["file"])
            enemies = {e["id"]: e for e in data["enemies"]}
            skills = {s["id"]: s for s in data["skills"]}
            finale_id = data["zones"][-1]["enemies"][-1]
            rows = []
            for zone in data["zones"]:
                level = zone["level"]
                hp = player_hp(mode, level)
                # Average damage of the zone's skills at this level (no weak point bonus)
                avg_skill = sum(skills[s]["damage"] for s in zone["skills"]) / len(zone["skills"])
                your_damage = avg_skill * (1 + (level - 1) * DAMAGE_PER_LEVEL)
                cells = {}
                for enemy_id in zone["enemies"]:
                    enemy = enemies[enemy_id]
                    kind = kind_of(enemy, finale_id)
                    if old:
                        dmg = enemy_damage_old(mode, area, kind)
                    else:
                        dmg = enemy_damage_new(mode, level, kind)
                    hits = math.ceil(hp / dmg)
                    chance = min(mode["hitChance"] + (BOSS_HIT_BONUS if enemy.get("boss") else 0), MAX_HIT_CHANCE)
                    survive = hits / chance
                    enemy_hp = round(enemy["hp"] * mode["enemyHpScale"])
                    win = math.ceil(enemy_hp / your_damage) / ACCURACY
                    low, high = TARGETS[mode_id][kind]
                    # Keep the worst (fewest hits) enemy of each kind in the zone
                    if kind not in cells or hits < cells[kind][0]:
                        cells[kind] = (hits, survive, win, not (low <= hits <= high))
                rows.append((zone, level, cells))

            if full:
                for zone, level, cells in rows:
                    print("  L%-2d %-20s" % (level, zone["name"][:20]), end="")
                    for kind in ("normal", "sub-boss", "finale"):
                        if kind in cells:
                            h, s, w, off = cells[kind]
                            print("  %-8s %2d%s [%4.1f/%4.1f]" % (kind, h, "*" if off else " ", s, w), end="")
                    print()
            else:
                # One line per area: the range of hits to die for each kind
                print("  %-22s" % area["name"], end="")
                for kind in ("normal", "sub-boss", "finale"):
                    found = [c[kind] for _, _, c in rows if kind in c]
                    if not found:
                        continue
                    hits = [f[0] for f in found]
                    tight = min(f[1] - f[2] for f in found)  # survive minus win: below 0 = likely death
                    off = "*" if any(f[3] for f in found) else " "
                    span = "%d" % min(hits) if min(hits) == max(hits) else "%d-%d" % (min(hits), max(hits))
                    print("  %-8s %-5s%s margin %+5.1f" % (kind, span, off, tight), end="")
                print()
        print()
    print("margin = turns you survive minus turns to win, worst zone in the area.")
    print("Below 0 means the average player usually dies there (weak point hits and armor help).")


main()
