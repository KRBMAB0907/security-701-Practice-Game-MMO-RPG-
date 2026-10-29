"""Question bank checker.

Run from the repo's main folder:
    python tools/check_questions.py

It checks every question file in data/questions/ against data/topics.json
and reports problems, plus a summary of how many questions each objective
has and where the correct answers sit. Run it after adding or editing
questions, before you commit.
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPICS_FILE = ROOT / "data" / "topics.json"
QUESTIONS_DIR = ROOT / "data" / "questions"
REQUIRED_FIELDS = ["id", "objective", "topic", "question", "choices", "answer", "explanation"]


def main():
    topics = json.loads(TOPICS_FILE.read_text())

    # Build lookups from topics.json: objective -> domain, topic -> objective
    objective_domain = {}
    topic_objective = {}
    for domain in topics["domains"]:
        for objective in domain["objectives"]:
            objective_domain[objective["id"]] = domain["id"]
            for topic in objective["topics"]:
                topic_objective[topic["id"]] = objective["id"]

    problems = []
    seen_ids = {}
    seen_text = {}
    per_objective = Counter()
    per_topic = Counter()
    answer_spots = Counter()
    total = 0

    files = sorted(QUESTIONS_DIR.glob("domain*.json"))
    if not files:
        print("No question files found in", QUESTIONS_DIR)
        return 1

    for path in files:
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as error:
            problems.append(f"{path.name}: not valid JSON ({error})")
            continue

        for q in data.get("questions", []):
            total += 1
            where = f"{path.name} {q.get('id', '(no id)')}"

            missing = [field for field in REQUIRED_FIELDS if field not in q]
            if missing:
                problems.append(f"{where}: missing {', '.join(missing)}")
                continue

            if q["id"] in seen_ids:
                problems.append(f"{where}: duplicate id (also in {seen_ids[q['id']]})")
            seen_ids[q["id"]] = path.name

            text = q["question"].strip().lower()
            if text in seen_text:
                problems.append(f"{where}: same question text as {seen_text[text]}")
            seen_text[text] = q["id"]

            if q["objective"] not in objective_domain:
                problems.append(f"{where}: unknown objective {q['objective']}")
            elif objective_domain[q["objective"]] != data.get("domain"):
                problems.append(f"{where}: objective {q['objective']} is not in domain {data.get('domain')}")

            if q["topic"] not in topic_objective:
                problems.append(f"{where}: unknown topic '{q['topic']}' (add it to topics.json?)")
            elif topic_objective[q["topic"]] != q["objective"]:
                problems.append(f"{where}: topic '{q['topic']}' belongs to objective {topic_objective[q['topic']]}, not {q['objective']}")

            choices = q["choices"]
            if len(choices) != 4:
                problems.append(f"{where}: has {len(choices)} choices, expected 4")
            if len(set(c.strip().lower() for c in choices)) != len(choices):
                problems.append(f"{where}: two choices are the same")
            if not isinstance(q["answer"], int) or not 0 <= q["answer"] < len(choices):
                problems.append(f"{where}: answer {q['answer']} is not a valid choice number")
            else:
                answer_spots[q["answer"]] += 1

            if len(q["explanation"].strip()) < 20:
                problems.append(f"{where}: explanation is missing or too short")

            per_objective[q["objective"]] += 1
            per_topic[q["topic"]] += 1

    # Every objective and topic in topics.json should have questions
    for objective in objective_domain:
        if per_objective[objective] == 0:
            problems.append(f"objective {objective} has no questions")
    empty_topics = [t for t in topic_objective if per_topic[t] == 0]

    # Summary
    print(f"Checked {total} questions in {len(files)} files.\n")
    print("Questions per objective:")
    for domain in topics["domains"]:
        counts = "  ".join(f"{o['id']}:{per_objective[o['id']]}" for o in domain["objectives"])
        print(f"  Domain {domain['id']}  {counts}")
    print("\nCorrect answer positions (1st/2nd/3rd/4th choice):",
          " / ".join(str(answer_spots[i]) for i in range(4)))
    if empty_topics:
        print("Topics with no questions yet:", ", ".join(empty_topics))

    if problems:
        print(f"\n{len(problems)} problem(s) found:")
        for problem in problems:
            print("  -", problem)
        return 1

    print("\nNo problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
