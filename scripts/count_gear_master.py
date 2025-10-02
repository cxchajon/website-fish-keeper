"""Utility script to summarize gear_master.csv contents."""
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = REPO_ROOT / "gear_master.csv"


def main() -> None:
    category_counts: Counter[str] = Counter()
    total_rows = 0

    with CSV_PATH.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            total_rows += 1
            category = row.get("Category", "").strip() or "(Uncategorized)"
            category_counts[category] += 1

    print(f"Total rows: {total_rows}")
    for category, count in sorted(category_counts.items()):
        print(f"{category}: {count}")


if __name__ == "__main__":
    main()
