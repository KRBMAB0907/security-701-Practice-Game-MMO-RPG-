"""Game data checker.

Run from the repo's main folder:
    python tools/check_game_data.py

It checks that areas, zones, enemies, skills, classes and art all link up:
every enemy weakness can be hit by a skill in its zone, every skill's
topics exist and have questions, IDs are unique, and so on. Run it after
editing anything in data/areas/, data/areas.json, data/classes.json,
data/loot.json, data/camp.json, data/skilltree.json or data/ascension.json.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIN_QUESTIONS_PER_SKILL = 4  # fewer than this and players see lots of repeats


def load(relative_path):
    return json.loads((ROOT / relative_path).read_text())


def main():
    problems = []
    topics = load("data/topics.json")
    topic_domain = {}
    for domain in topics["domains"]:
        for objective in domain["objectives"]:
            for topic in objective["topics"]:
                topic_domain[topic["id"]] = domain["id"]

    all_skills, all_enemies, all_zones = {}, {}, {}
    used_skills = set()
    summary = []

    for area in load("data/areas.json")["areas"]:
        if area["file"] is None:
            summary.append(f"  {area['name']}: coming soon")
            continue

        missing = [path for path in (area["file"], area["questions"]) if not (ROOT / path).exists()]
        if missing:
            problems.append(f"{area['name']}: file not found: {', '.join(missing)}")
            continue

        data = load(area["file"])
        questions = load(area["questions"])["questions"]
        per_topic = Counter(q["topic"] for q in questions)
        where = area["file"]

        for skill in data["skills"]:
            if skill["id"] in all_skills:
                problems.append(f"{where}: skill id '{skill['id']}' is used twice")
            all_skills[skill["id"]] = skill
            for topic in skill["topics"]:
                if topic not in topic_domain:
                    problems.append(f"{where}: skill '{skill['id']}' uses unknown topic '{topic}'")
                elif topic_domain[topic] != area["domain"]:
                    problems.append(f"{where}: skill '{skill['id']}' topic '{topic}' is not in domain {area['domain']}")
            available = sum(per_topic[t] for t in skill["topics"])
            if available < MIN_QUESTIONS_PER_SKILL:
                problems.append(f"{where}: skill '{skill['id']}' only has {available} questions (want {MIN_QUESTIONS_PER_SKILL}+)")

        for enemy in data["enemies"]:
            if enemy["id"] in all_enemies:
                problems.append(f"{where}: enemy id '{enemy['id']}' is used twice")
            all_enemies[enemy["id"]] = enemy
            if "weakness" not in enemy and "phases" not in enemy:
                problems.append(f"{where}: enemy '{enemy['id']}' has no weakness or phases")
            sprite = enemy.get("sprite")
            if sprite is None:
                problems.append(f"{where}: enemy '{enemy['id']}' has no sprite (it will be drawn as a square)")
            elif not (ROOT / "assets" / "sprites" / "enemies" / f"{sprite}.png").exists():
                problems.append(f"{where}: enemy '{enemy['id']}' uses missing sprite assets/sprites/enemies/{sprite}.png")

        for zone in data["zones"]:
            if zone["id"] in all_zones:
                problems.append(f"{where}: zone id '{zone['id']}' is used twice")
            all_zones[zone["id"]] = zone
            if "level" not in zone:
                problems.append(f"{where}: zone '{zone['id']}' has no level (needed for loot)")
            if not zone["enemies"]:
                problems.append(f"{where}: zone '{zone['id']}' has no enemies")

            zone_topics = set()
            for skill_id in zone["skills"]:
                used_skills.add(skill_id)
                if skill_id not in all_skills:
                    problems.append(f"{where}: zone '{zone['id']}' uses unknown skill '{skill_id}'")
                else:
                    zone_topics.update(all_skills[skill_id]["topics"])

            for enemy_id in zone["enemies"]:
                enemy = all_enemies.get(enemy_id)
                if enemy is None:
                    problems.append(f"{where}: zone '{zone['id']}' uses unknown enemy '{enemy_id}'")
                    continue
                for weakness in enemy.get("phases") or [enemy.get("weakness")]:
                    if weakness not in zone_topics:
                        problems.append(f"{where}: in zone '{zone['id']}', no skill can hit {enemy_id}'s weakness '{weakness}'")

        if not (ROOT / "assets" / "backgrounds" / f"{area['id']}.png").exists():
            problems.append(f"{area['name']}: missing background assets/backgrounds/{area['id']}.png")

        summary.append(f"  {area['name']}: {len(data['zones'])} zones, {len(data['enemies'])} enemies, "
                       f"{len(data['skills'])} skills, {len(questions)} questions")

    for skill_id in all_skills:
        if skill_id not in used_skills:
            problems.append(f"skill '{skill_id}' is not used in any zone")

    for player_class in load("data/classes.json")["classes"]:
        if not (ROOT / "assets" / "sprites" / "classes" / f"{player_class['id']}.png").exists():
            problems.append(f"class '{player_class['id']}' is missing assets/sprites/classes/{player_class['id']}.png")
        for skill_id in player_class["favoredSkills"]:
            if skill_id not in all_skills:
                problems.append(f"class '{player_class['id']}' favors unknown skill '{skill_id}'")

    # Gear art: every item type needs an icon, and every armor needs an overlay per class
    loot = load("data/loot.json")
    class_ids = [c["id"] for c in load("data/classes.json")["classes"]]
    for item_type in loot["bases"] + loot["legendaries"]:
        icon = item_type.get("icon")
        if icon is None:
            problems.append(f"loot item '{item_type['name']}' has no icon")
            continue
        if not (ROOT / "assets" / "sprites" / "items" / f"{icon}.png").exists():
            problems.append(f"missing item icon assets/sprites/items/{icon}.png")
        if item_type["slot"] == "armor":
            for class_id in class_ids:
                if not (ROOT / "assets" / "sprites" / "armor" / f"{icon}-{class_id}.png").exists():
                    problems.append(f"missing armor overlay assets/sprites/armor/{icon}-{class_id}.png")

    # Home camp: every loot tier has a scrap and a smelt amount, every cost
    # uses real tiers, and the camp art exists
    camp = load("data/camp.json")
    tier_ids = [tier["id"] for tier in loot["tiers"]]
    for field in ("materials", "smeltYield", "relevelCost"):
        for tier_id in tier_ids:
            if tier_id not in camp[field]:
                problems.append(f"data/camp.json: {field} has nothing for tier '{tier_id}'")
    costs = [("legendaryCost", camp["legendaryCost"])]
    for field in ("forgeCost", "upgradeCost", "relevelCost"):
        for tier_id, cost in camp[field].items():
            if tier_id not in tier_ids:
                problems.append(f"data/camp.json: {field} uses unknown tier '{tier_id}'")
            costs.append((f"{field} {tier_id}", cost))
    if "legendary" in camp["forgeCost"] or "legendary" in camp["upgradeCost"]:
        problems.append("data/camp.json: legendaries are made with legendaryCost, not forgeCost or upgradeCost")
    for where, cost in costs:
        for tier_id, amount in cost.items():
            if tier_id not in tier_ids or amount < 1:
                problems.append(f"data/camp.json: {where} costs {amount} of unknown or bad tier '{tier_id}'")
    if not (ROOT / "assets" / "backgrounds" / "camp.png").exists():
        problems.append("missing camp background assets/backgrounds/camp.png")
    for npc in camp["npcs"]:
        if not (ROOT / "assets" / "sprites" / "npcs" / f"{npc['id']}.png").exists():
            problems.append(f"camp person '{npc['id']}' is missing assets/sprites/npcs/{npc['id']}.png")
    # Su Root (js/mastery.js) needs a line for each moment of a drill
    trainer = next((npc for npc in camp["npcs"] if npc["id"] == "su-root"), None)
    if trainer is None:
        problems.append("data/camp.json: Su Root (id 'su-root') is missing; the mastery tab needs him")
    else:
        for kind in ("correct", "wrong", "rankUp", "drillDone"):
            if not trainer.get("lines", {}).get(kind):
                problems.append(f"data/camp.json: Su Root has no '{kind}' lines")
    summary.append(f"  Home camp: {len(camp['npcs'])} people, {len(camp['forgeCost'])} forge tiers")

    # Skill tree: ids unique, tiers valid, stats and keystones the code knows about
    tree = load("data/skilltree.json")
    known_stats = {"damage", "hp", "time", "heal", "weakness", "dodge", "defense", "xp", "loot", "domainDamage"}
    known_keystones = {"zero-trust", "assume-breach", "defense-in-depth", "rapid-response", "accept-the-risk"}  # see js/skilltree.js
    tier_count = len(tree["tierCosts"])
    node_ids = set()
    tree_points = 0
    for branch in tree["branches"]:
        if branch["domain"] not in {d["id"] for d in topics["domains"]}:
            problems.append(f"skill tree branch '{branch['name']}' uses unknown domain {branch['domain']}")
        for node in branch["nodes"]:
            where = f"skill tree node '{node['id']}'"
            if node["id"] in node_ids:
                problems.append(f"{where} is used twice")
            node_ids.add(node["id"])
            tree_points += node["maxRank"]
            if not 1 <= node["tier"] <= tier_count:
                problems.append(f"{where} has tier {node['tier']} (must be 1 to {tier_count})")
            if node["kind"] not in {"small", "notable", "keystone"}:
                problems.append(f"{where} has unknown kind '{node['kind']}'")
            if node["kind"] == "keystone" and node.get("keystone") not in known_keystones:
                problems.append(f"{where} has unknown keystone rule '{node.get('keystone')}'")
            for stat in node["stats"]:
                if stat not in known_stats:
                    problems.append(f"{where} has unknown stat '{stat}'")
            for field in ("name", "text", "concept"):
                if not node.get(field):
                    problems.append(f"{where} has no {field}")
    summary.append(f"  Skill tree: {len(node_ids)} nodes, {tree_points} points to fill it")

    # Ascension: every class has 2 ascendancies of 8 nodes (3 + 3 + 2 capstones),
    # and every stat is one the code knows (see the list in js/ascension.js)
    ascension = load("data/ascension.json")
    ascension_stats = known_stats - {"loot", "domainDamage"} | {
        "blockHits", "maxHitPercent", "counterOnMiss", "cheatDeath", "streakHeal", "lowHpDefense",
        "dodgeAfterCorrect", "streakDamage", "bossDamage", "bossDefense", "healOnWrong", "weakHealPercent",
        "missDamage", "critChance", "critMultiplier", "critEveryN", "firstHitBonus", "thorns",
        "enemyMissHeal", "defenseAfterWrong", "eliminate", "emergencyHeal", "dodgePerHit", "lifesteal",
        "wildcard", "hpPercent"}
    ascension_tiers = len(ascension["tierCosts"])
    ascension_ids = set()
    ascendancy_count = 0
    covered_classes = set()
    for entry in ascension["classes"]:
        if entry["classId"] not in class_ids:
            problems.append(f"ascension lists unknown class '{entry['classId']}'")
        covered_classes.add(entry["classId"])
        if len(entry["ascendancies"]) != 2:
            problems.append(f"class '{entry['classId']}' has {len(entry['ascendancies'])} ascendancies (want 2)")
        for ascendancy in entry["ascendancies"]:
            ascendancy_count += 1
            per_tier = Counter(node["tier"] for node in ascendancy["nodes"])
            if [per_tier[1], per_tier[2], per_tier[3]] != [3, 3, 2]:
                problems.append(f"ascendancy '{ascendancy['id']}' needs 3 tier-1, 3 tier-2 and 2 tier-3 nodes "
                                f"(has {per_tier[1]}, {per_tier[2]}, {per_tier[3]})")
            for node in ascendancy["nodes"]:
                where = f"ascension node '{node['id']}'"
                if node["id"] in ascension_ids or node["id"] in node_ids:
                    problems.append(f"{where} id is used twice")
                ascension_ids.add(node["id"])
                if not 1 <= node["tier"] <= ascension_tiers:
                    problems.append(f"{where} has tier {node['tier']} (must be 1 to {ascension_tiers})")
                for stat in node["stats"]:
                    if stat not in ascension_stats:
                        problems.append(f"{where} has unknown stat '{stat}'")
                for field in ("name", "text", "concept"):
                    if not node.get(field):
                        problems.append(f"{where} has no {field}")
    for class_id in class_ids:
        if class_id not in covered_classes:
            problems.append(f"class '{class_id}' has no ascendancies in data/ascension.json")
    summary.append(f"  Ascension: {ascendancy_count} ascendancies, {len(ascension_ids)} nodes")

    # Gear affixes and set items (js/affixes.js): they use the same stats as
    # the skill tree and ascension, so every stat must be one combat knows
    gear_stats = ascension_stats | {"loot"}
    tier_ids = [tier["id"] for tier in loot["tiers"]]
    slot_ids = [slot["id"] for slot in loot["slots"]]
    for tier_id in tier_ids:
        if tier_id not in loot["affixCount"]:
            problems.append(f"data/loot.json: affixCount has nothing for tier '{tier_id}'")
    affix_ids = set()
    for affix in loot["affixes"]:
        where = f"affix '{affix['id']}'"
        if affix["id"] in affix_ids:
            problems.append(f"{where} is used twice")
        affix_ids.add(affix["id"])
        if affix["kind"] not in {"prefix", "suffix"}:
            problems.append(f"{where} has kind '{affix['kind']}' (must be prefix or suffix)")
        if affix.get("minTier") is not None and affix["minTier"] not in tier_ids:
            problems.append(f"{where} has unknown minTier '{affix['minTier']}'")
        for field in ("name", "text", "concept"):
            if not affix.get(field):
                problems.append(f"{where} has no {field}")
        for stat, value_range in affix["stats"].items():
            if stat not in gear_stats:
                problems.append(f"{where} has unknown stat '{stat}'")
            if len(value_range) != 2 or value_range[0] > value_range[1]:
                problems.append(f"{where}: stat '{stat}' needs [lowest, highest], got {value_range}")
        for placeholder in re.findall(r"\{(\w+)\}", affix["text"]):
            if placeholder not in affix["stats"]:
                problems.append(f"{where}: text uses {{{placeholder}}} but has no such stat")
    area_ids = {area["id"] for area in load("data/areas.json")["areas"]}
    for item_set in loot["sets"]:
        where = f"set '{item_set['id']}'"
        if item_set["area"] not in area_ids | {"finale"}:
            problems.append(f"{where} drops in unknown area '{item_set['area']}' (use an area id or \"finale\")")
        if sorted(piece["slot"] for piece in item_set["pieces"]) != sorted(slot_ids):
            problems.append(f"{where} needs exactly one piece for each slot: {', '.join(slot_ids)}")
        for piece in item_set["pieces"]:
            if not (ROOT / "assets" / "sprites" / "items" / f"{piece['icon']}.png").exists():
                problems.append(f"{where}: piece '{piece['name']}' uses missing icon {piece['icon']}")
            if piece["slot"] == "armor":
                for class_id in class_ids:
                    if not (ROOT / "assets" / "sprites" / "armor" / f"{piece['icon']}-{class_id}.png").exists():
                        problems.append(f"{where}: missing armor overlay for '{piece['icon']}' on {class_id}")
        for bonus in item_set["bonuses"]:
            if not 1 <= bonus["pieces"] <= len(item_set["pieces"]):
                problems.append(f"{where}: a bonus needs {bonus['pieces']} pieces, but the set has {len(item_set['pieces'])}")
            for stat in bonus["stats"]:
                if stat not in gear_stats:
                    problems.append(f"{where}: bonus has unknown stat '{stat}'")
            if not bonus.get("text"):
                problems.append(f"{where}: a bonus has no text")
    summary.append(f"  Gear: {len(loot['affixes'])} affixes, {len(loot['sets'])} sets")

    print("Areas:")
    print("\n".join(summary))

    if problems:
        print(f"\n{len(problems)} problem(s) found:")
        for problem in problems:
            print("  -", problem)
        return 1

    print("\nNo problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
