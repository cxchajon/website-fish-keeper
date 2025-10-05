"""Rebuild canonical Amazon affiliate links for gear CSV data."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = BASE_DIR / "reports"

MASTER_CSV = DATA_DIR / "gear_master.csv"

CANONICAL_TEMPLATE = "https://www.amazon.com/dp/{asin}/?tag=fishkeepingli-20"
ASIN_PATTERN = re.compile(r"^[A-Z0-9]{10}$")


@dataclass
class LinkRecord:
    row: Dict[str, str]
    original_link: str
    asin: str


def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return [dict(row) for row in reader]


def write_csv(path: Path, rows: Sequence[Dict[str, str]], header: Sequence[str]) -> None:
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(header), lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    new_content = buffer.getvalue()

    try:
        existing_content = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        existing_content = None

    if existing_content == new_content:
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new_content, encoding="utf-8")


def canonicalise_rows(rows: Iterable[Dict[str, str]]) -> List[LinkRecord]:
    results: List[LinkRecord] = []
    for row in rows:
        asin_raw = (row.get("ASIN", "") or "").strip().upper()
        original_link = (row.get("Amazon_Link", "") or "").strip()

        if asin_raw and ASIN_PATTERN.fullmatch(asin_raw):
            canonical_link = CANONICAL_TEMPLATE.format(asin=asin_raw)
            row["ASIN"] = asin_raw
            row["Amazon_Link"] = canonical_link
        else:
            row["Amazon_Link"] = ""

        results.append(LinkRecord(row=row, original_link=original_link, asin=asin_raw))

    return results


def read_header(path: Path) -> List[str]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        try:
            return next(reader)
        except StopIteration:
            return []


def discover_category_files() -> Dict[Path, Tuple[str, List[str]]]:
    mapping: Dict[Path, Tuple[str, List[str]]] = {}
    for path in DATA_DIR.glob("gear_*.csv"):
        if path.name == "gear_master.csv":
            continue
        stem = path.stem.replace("gear_", "")
        if not stem:
            continue
        category = stem.replace("_", " ").title()
        header = read_header(path)
        mapping[path] = (category, header)
    return mapping


def build_summary(
    records: Sequence[LinkRecord],
    header: Sequence[str],
    missing_asins_path: Path,
    summary_path: Path,
) -> None:
    rows_read = len(records)
    missing_asin_rows: List[Dict[str, str]] = []
    fixed_examples: List[str] = []

    for record in records:
        row = record.row
        if not (record.asin and ASIN_PATTERN.fullmatch(record.asin)):
            missing_asin_rows.append(row)
        else:
            canonical = row.get("Amazon_Link", "")
            if canonical and canonical != record.original_link:
                fixed_examples.append(
                    f"{record.original_link or '[empty]'} -> {canonical}"
                )

    missing_asins_path.parent.mkdir(parents=True, exist_ok=True)
    with missing_asins_path.open("w", encoding="utf-8") as handle:
        if not missing_asin_rows:
            handle.write("All rows contain a valid ASIN.\n")
        else:
            writer = csv.DictWriter(handle, fieldnames=list(header))
            writer.writeheader()
            for row in missing_asin_rows:
                writer.writerow(row)

    summary_lines = [
        "Affiliate Link Fix Summary",
        "===========================",
        f"Rows processed: {rows_read}",
        f"Rows with valid ASIN: {rows_read - len(missing_asin_rows)}",
        f"Rows missing/invalid ASIN: {len(missing_asin_rows)}",
        "",
    ]

    if fixed_examples:
        summary_lines.append("Sample link updates:")
        summary_lines.extend(f"  - {example}" for example in fixed_examples[:10])
    else:
        summary_lines.append("No link updates were required; all links were already canonical.")

    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")


def main() -> None:
    if not MASTER_CSV.exists():
        raise SystemExit("gear_master.csv not found in /data directory")

    master_rows = read_csv(MASTER_CSV)
    header = []
    if master_rows:
        header = list(master_rows[0].keys())
    else:
        with MASTER_CSV.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.reader(handle)
            header = next(reader)

    records = canonicalise_rows(master_rows)
    write_csv(MASTER_CSV, [record.row for record in records], header)

    category_files = discover_category_files()
    if category_files:
        for path, (category, category_header) in category_files.items():
            filtered_rows = [record.row for record in records if record.row.get("Category") == category]
            header_to_use = category_header or header
            write_csv(path, filtered_rows, header_to_use)

    build_summary(
        records,
        header,
        missing_asins_path=REPORTS_DIR / "missing_asins.txt",
        summary_path=REPORTS_DIR / "link_fix_summary.txt",
    )


if __name__ == "__main__":
    main()
