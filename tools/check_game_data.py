"""Game data checker.

Run from the repo's main folder:
    python tools/check_game_data.py

It checks that areas, zones, enemies, skills and classes all link up:
every enemy weakness can be hit by a skill in its zone, every skill's
topics exist and have questions, IDs are unique, and so on. Run it after
editing anything in data/areas/, data/areas.json or data/classes.json.
"""
import json
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

        summary.append(f"  {area['name']}: {len(data['zones'])} zones, {len(data['enemies'])} enemies, "
                       f"{len(data['skills'])} skills, {len(questions)} questions")

    for skill_id in all_skills:
        if skill_id not in used_skills:
            problems.append(f"skill '{skill_id}' is not used in any zone")

    for player_class in load("data/classes.json")["classes"]:
        for skill_id in player_class["favoredSkills"]:
            if skill_id not in all_skills:
                problems.append(f"class '{player_class['id']}' favors unknown skill '{skill_id}'")

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
