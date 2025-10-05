#!/usr/bin/env python3
"""Convert Amazon Lighting export to gear master schema."""
from __future__ import annotations

import csv
import re
import sys
import urllib.error
import urllib.request
from collections import OrderedDict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
INPUT_FILE = REPO_ROOT / "data/raw/LIGHTS.csv"
OUTPUT_FILE = REPO_ROOT / "gear_master.csv"
MISSING_ASINS_FILE = REPO_ROOT / "reports/missing_asins.txt"
SUMMARY_FILE = REPO_ROOT / "reports/summary.txt"

CATEGORY = "Lighting"
SOURCE_LIST = "Lighting"
ASSOCIATE_TAG = "fishkeepingli-20"

ASIN_CANDIDATE_FIELDS = [
    "asin",
    "asin or isbn",
    "asin/isbn",
    "asin or isbn-13",
    "asin/isbn-13",
    "isbn",
    "product id",
    "productid",
    "item id",
]

TITLE_CANDIDATE_FIELDS = [
    "item title",
    "title",
    "item name",
    "description",
    "item",
    "product name",
]

COMMENT_FIELDS = ["comment", "comments", "notes", "note"]
URL_FIELDS = ["url", "link", "product url", "amazon link", "asin url", "asin link"]

SHORTLINK_DOMAINS = {"a.co", "amzn.to"}

UNSAFE_PATTERNS = [
    re.compile(r"\$\s*\d+[\d,]*(?:\.\d+)?", re.I),
    re.compile(r"\bUSD\b", re.I),
    re.compile(r"\bIn\s+stock\b", re.I),
    re.compile(r"\bShips?\b", re.I),
    re.compile(r"\bAvailable\b", re.I),
]

COLLAPSE_SPACES_RE = re.compile(r"\s+")
ASIN_RE = re.compile(r"([A-Z0-9]{10})")
AMAZON_ASIN_RE = re.compile(
    r"/(?:dp|gp/product|gp/aw/d|gp/slredirect)/([A-Z0-9]{10})",
    re.I,
)


class ConversionStats:
    def __init__(self) -> None:
        self.rows_read = 0
        self.rows_written = 0
        self.duplicates = 0
        self.missing_asins: List[str] = []
        self.price_phrases_removed = 0

    def register_missing(self, title: str) -> None:
        self.missing_asins.append(title)

    def register_price_removal(self) -> None:
        self.price_phrases_removed += 1


def normalize_keyed(row: Dict[str, str]) -> Dict[str, str]:
    return {key.lower().strip(): (value or "").strip() for key, value in row.items()}


def first_value(row: Dict[str, str], keys: Iterable[str]) -> str:
    for key in keys:
        if key in row:
            value = row[key].strip()
            if value:
                return value
    return ""


def build_amazon_link(asin: str) -> str:
    return f"https://www.amazon.com/dp/{asin}/?tag={ASSOCIATE_TAG}"


def infer_product_type(title: str) -> str:
    lowered = title.lower()
    if any(keyword in lowered for keyword in ("led", "strip", "bar")):
        return "Bar Light"
    if any(keyword in lowered for keyword in ("clip", "clamp", "gooseneck")):
        return "Clip Light"
    if any(keyword in lowered for keyword in ("hood", "fixture", "cover")):
        return "Hood Light"
    return ""


def extract_asin_from_url(url: str) -> Optional[str]:
    match = AMAZON_ASIN_RE.search(url)
    if match:
        return match.group(1).upper()
    match = ASIN_RE.search(url.upper())
    if match:
        return match.group(1).upper()
    return None


def resolve_shortlink(url: str) -> Optional[str]:
    try:
        with urllib.request.urlopen(url, timeout=5) as response:  # type: ignore[arg-type]
            final_url = response.geturl()
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError):
        return None
    return extract_asin_from_url(final_url)


def sanitize_notes(raw_note: str, stats: ConversionStats) -> str:
    note = raw_note
    removal_triggered = False
    for pattern in UNSAFE_PATTERNS:
        if pattern.search(note):
            note = pattern.sub("", note)
            removal_triggered = True
    if removal_triggered:
        stats.register_price_removal()
    cleaned = COLLAPSE_SPACES_RE.sub(" ", note).strip(" ,.-")
    return cleaned


def detect_asin(row: Dict[str, str]) -> Optional[str]:
    asin = first_value(row, ASIN_CANDIDATE_FIELDS)
    if asin:
        return asin.upper()
    url_value = first_value(row, URL_FIELDS)
    if url_value:
        asin_from_url = extract_asin_from_url(url_value)
        if asin_from_url:
            return asin_from_url
        parsed_domain = url_value.split("//")[-1].split("/")[0].lower()
        if parsed_domain in SHORTLINK_DOMAINS:
            asin_from_short = resolve_shortlink(url_value)
            if asin_from_short:
                return asin_from_short
    return None


def transform_rows(rows: List[Dict[str, str]], stats: ConversionStats) -> List[OrderedDict[str, str]]:
    deduped: Dict[str, OrderedDict[str, str]] = OrderedDict()

    for raw_row in rows:
        stats.rows_read += 1
        normalized = normalize_keyed(raw_row)
        title = first_value(normalized, TITLE_CANDIDATE_FIELDS)
        comment = first_value(normalized, COMMENT_FIELDS)

        asin = detect_asin(normalized)
        if not asin:
            if title:
                stats.register_missing(title)
            else:
                stats.register_missing("<missing title>")
            continue

        product_name = title.strip().strip('"')
        notes = sanitize_notes(comment, stats)

        product_type = infer_product_type(product_name)

        transformed = OrderedDict([
            ("Category", CATEGORY),
            ("Product_Type", product_type),
            ("Product_Name", product_name),
            ("Use_Case", ""),
            ("Recommended_Specs", ""),
            ("Plant_Ready", "Yes"),
            ("Price_Range", ""),
            ("Notes", notes),
            ("Amazon_Link", build_amazon_link(asin)),
            ("Chewy_Link", ""),
            ("ASIN", asin.upper()),
            ("Source_List", SOURCE_LIST),
        ])

        if asin in deduped:
            stats.duplicates += 1
            existing_notes = deduped[asin]["Notes"]
            if notes and notes not in existing_notes:
                if existing_notes:
                    deduped[asin]["Notes"] = f"{existing_notes}; {notes}"
                else:
                    deduped[asin]["Notes"] = notes
            continue

        deduped[asin] = transformed

    stats.rows_written = len(deduped)
    return list(deduped.values())


def read_input() -> List[Dict[str, str]]:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")
    with INPUT_FILE.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def write_output(rows: List[OrderedDict[str, str]]) -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = list(rows[0].keys()) if rows else [
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
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_reports(stats: ConversionStats) -> None:
    MISSING_ASINS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if stats.missing_asins:
        with MISSING_ASINS_FILE.open("w", encoding="utf-8") as handle:
            for title in stats.missing_asins:
                handle.write(f"{title}\n")
    else:
        if MISSING_ASINS_FILE.exists():
            MISSING_ASINS_FILE.unlink()

    with SUMMARY_FILE.open("w", encoding="utf-8") as handle:
        handle.write(f"Rows read: {stats.rows_read}\n")
        handle.write(f"Rows written: {stats.rows_written}\n")
        handle.write(f"Duplicate ASINs removed: {stats.duplicates}\n")
        handle.write(f"Missing ASINs: {len(stats.missing_asins)}\n")
        handle.write(f"Price/availability phrases stripped: {stats.price_phrases_removed}\n")


def main() -> int:
    try:
        raw_rows = read_input()
    except FileNotFoundError as error:
        sys.stderr.write(f"{error}\n")
        return 1

    stats = ConversionStats()
    transformed_rows = transform_rows(raw_rows, stats)
    write_output(transformed_rows)
    write_reports(stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
