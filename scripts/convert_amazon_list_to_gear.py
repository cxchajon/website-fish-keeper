#!/usr/bin/env python3
"""Convert Amazon List exports into gear CSVs for the site."""
from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional

AFFILIATE_TAG = "fishkeepingli-20"
CANONICAL_URL = "https://www.amazon.com/dp/{asin}/?tag={tag}"
OUTPUT_HEADERS = [
    "Category",
    "Product_Type",
    "Product_Name",
    "Use_Case",
    "Recommended_Specs",
    "Plant_Ready",
    "Price_Range",
    "Notes",
    "Amazon_Link",
    "Chewy_Link",
    "ASIN",
    "Source_List",
]
CATEGORY_KEYWORDS = {
    "light": "Lighting",
    "lights": "Lighting",
    "lighting": "Lighting",
    "filtr": "Filtration",
    "filter": "Filtration",
    "heat": "Heating",
    "heater": "Heating",
    "substrate": "Substrate",
    "soil": "Substrate",
}
LIGHTING_TYPES = [
    (re.compile(r"(led|strip|bar)", re.I), "Bar Light"),
    (re.compile(r"(clip|clamp|gooseneck)", re.I), "Clip Light"),
    (re.compile(r"(hood|fixture|cover)", re.I), "Hood Light"),
]
FILTRATION_TYPES = [
    (re.compile(r"canister", re.I), "Canister Filter"),
    (re.compile(r"(hob|hang)", re.I), "Hang-On-Back Filter"),
    (re.compile(r"sponge", re.I), "Sponge Filter"),
    (re.compile(r"internal", re.I), "Internal Filter"),
]

TITLE_CATEGORY_RULES = [
    (re.compile(r"(filter|canister|sponge|hang[- ]?on|hob)", re.I), "Filtration"),
    (re.compile(r"(light|led|fixture|lumen)", re.I), "Lighting"),
    (re.compile(r"(heater|heating)", re.I), "Heating"),
    (re.compile(r"(substrate|soil|gravel|sand)", re.I), "Substrate"),
]


@dataclass
class RowRecord:
    category: str
    product_type: str
    product_name: str
    notes: str
    amazon_link: str
    asin: str
    source_list: str
    raw_comments: List[str] = field(default_factory=list)

    def merge_notes(self, note: str) -> None:
        if note and note not in self.raw_comments:
            self.raw_comments.append(note)
            combined = "; ".join(filter(None, self.raw_comments))
            self.notes = combined


class Summary:
    def __init__(self) -> None:
        self.rows_read: Dict[str, int] = defaultdict(int)
        self.rows_written: int = 0
        self.duplicates: Dict[str, int] = defaultdict(int)
        self.missing_asins: List[str] = []

    def record_missing(self, source: str, row_index: int, title: str) -> None:
        entry = f"{source}: row {row_index} ({title or 'Untitled'})"
        self.missing_asins.append(entry)

    def write_reports(self, base_dir: Path) -> None:
        reports_dir = base_dir / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        summary_lines = ["Gear conversion summary", "======================", ""]
        total_duplicates = sum(self.duplicates.values())
        for source, count in self.rows_read.items():
            dup = self.duplicates.get(source, 0)
            summary_lines.append(f"{source}:")
            summary_lines.append(f"  Rows read: {count}")
            summary_lines.append(f"  Duplicates: {dup}")
            summary_lines.append("")
        summary_lines.append(f"Total rows written: {self.rows_written}")
        summary_lines.append(f"Total duplicates removed: {total_duplicates}")
        summary_lines.append(f"Missing ASIN rows: {len(self.missing_asins)}")
        summary_lines.append("")
        summary_lines.append("Affiliate tag enforced: fishkeepingli-20")
        summary_text = "\n".join(summary_lines) + "\n"
        (reports_dir / "summary.txt").write_text(summary_text, encoding="utf-8")

        if self.missing_asins:
            missing_text = "\n".join(self.missing_asins) + "\n"
            (reports_dir / "missing_asins.txt").write_text(
                missing_text, encoding="utf-8"
            )
        else:
            (reports_dir / "missing_asins.txt").write_text("None\n", encoding="utf-8")


def detect_category(filename: str) -> str:
    lower = filename.lower()
    for key, category in CATEGORY_KEYWORDS.items():
        if key in lower:
            return category
    return "Unknown"


def detect_category_from_title(title: str) -> Optional[str]:
    if not title:
        return None
    for pattern, category in TITLE_CATEGORY_RULES:
        if pattern.search(title):
            return category
    return None


def infer_product_type(category: str, title: str) -> str:
    if not title:
        return ""
    if category == "Lighting":
        for pattern, label in LIGHTING_TYPES:
            if pattern.search(title):
                return label
    if category == "Filtration":
        for pattern, label in FILTRATION_TYPES:
            if pattern.search(title):
                return label
    return ""


def canonicalize_title(title: str) -> str:
    if not title:
        return ""
    title = re.sub(r"\s+", " ", title).strip()
    return title


def clean_notes(notes: Optional[str]) -> str:
    if not notes:
        return ""
    text = notes.replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\$\s?\d[\d,]*(\.\d+)?", "", text)
    text = re.sub(r"USD\s?\d[\d,]*(\.\d+)?", "", text, flags=re.I)
    text = re.sub(r"(price|availability)[^;,.]*[;,.]?", "", text, flags=re.I)
    text = text.strip(" ;,.-")
    return text


def build_amazon_link(asin: str) -> str:
    asin = asin.upper()
    return CANONICAL_URL.format(asin=asin, tag=AFFILIATE_TAG)


def normalise_header(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def locate_columns(fieldnames: Iterable[str]) -> Dict[str, Optional[str]]:
    mapping = {"asin": None, "title": None, "comment": None}
    for field in fieldnames:
        key = normalise_header(field)
        if key in {"asin", "asinorisbn"} and mapping["asin"] is None:
            mapping["asin"] = field
        elif key in {"itemname", "itemtitle", "productname", "title", "itemdescription", "description"} and mapping["title"] is None:
            mapping["title"] = field
        elif key in {"comment", "notes", "itemnotes"} and mapping["comment"] is None:
            mapping["comment"] = field
    return mapping


def process_file(path: Path, summary: Summary, records: Dict[str, RowRecord]) -> None:
    filename = path.name
    category = detect_category(filename)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = locate_columns(reader.fieldnames or [])
        if not columns["asin"]:
            raise ValueError(f"Unable to detect ASIN column in {filename}")
        for index, row in enumerate(reader, start=2):
            summary.rows_read[filename] += 1
            asin_raw = (row.get(columns["asin"], "") or "").strip()
            if not asin_raw:
                title = (row.get(columns["title"], "") or "").strip()
                summary.record_missing(filename, index, title)
                continue
            asin = asin_raw.upper()
            title_raw = row.get(columns["title"], "") if columns["title"] else ""
            title = canonicalize_title(title_raw)
            row_category = category
            if row_category == "Unknown":
                detected = detect_category_from_title(title)
                if detected:
                    row_category = detected
            product_type = infer_product_type(row_category, title)
            notes_raw = row.get(columns["comment"], "") if columns["comment"] else ""
            notes = clean_notes(notes_raw)
            source_list = filename
            amazon_link = build_amazon_link(asin)

            if asin in records:
                summary.duplicates[filename] += 1
                records[asin].merge_notes(notes)
                continue

            record = RowRecord(
                category=row_category,
                product_type=product_type,
                product_name=title,
                notes=notes,
                amazon_link=amazon_link,
                asin=asin,
                source_list=source_list,
            )
            if notes:
                record.raw_comments.append(notes)
            records[asin] = record


def write_csv(path: Path, rows: List[RowRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_HEADERS)
        writer.writeheader()
        for record in rows:
            writer.writerow({
                "Category": record.category,
                "Product_Type": record.product_type,
                "Product_Name": record.product_name,
                "Use_Case": "",
                "Recommended_Specs": "",
                "Plant_Ready": "",
                "Price_Range": "",
                "Notes": record.notes,
                "Amazon_Link": record.amazon_link,
                "Chewy_Link": "",
                "ASIN": record.asin,
                "Source_List": record.source_list,
            })


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Convert Amazon list CSVs to site gear format")
    parser.add_argument("inputs", nargs="+", help="One or more Amazon list CSV files")
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[1]
    data_dir = repo_root / "data"
    records: Dict[str, RowRecord] = {}
    summary = Summary()

    for input_path in args.inputs:
        path = Path(input_path)
        if not path.is_file():
            parser.error(f"Input file not found: {input_path}")
        process_file(path, summary, records)

    rows = sorted(records.values(), key=lambda r: (r.category, r.product_name.lower()))
    summary.rows_written = len(rows)

    master_path = data_dir / "gear_master.csv"
    write_csv(master_path, rows)

    lighting_rows = [r for r in rows if r.category == "Lighting"]
    filtration_rows = [r for r in rows if r.category == "Filtration"]
    write_csv(data_dir / "gear_lighting.csv", lighting_rows)
    write_csv(data_dir / "gear_filtration.csv", filtration_rows)

    summary.write_reports(repo_root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
