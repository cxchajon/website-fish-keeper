#!/usr/bin/env python3
"""Convert Amazon list export to TheTankGuide gear master schema."""
from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Dict, Iterable, Optional

INPUT_FILE = Path("data/raw/exportedList_1K6C25CO6ESSX.csv")
OUTPUT_FILE = Path("data/gear_master.csv")

CATEGORY = "Filtration"
AMAZON_ASSOCIATE_TAG = "fishkeepinglife-20"

PRICE_BUDGET_MAX = 60.0
PRICE_MID_MAX = 150.0


def _normalize_keys(row: Dict[str, str]) -> Dict[str, str]:
    """Return a dict with lower-cased keys preserving original values."""
    return {key.lower(): value for key, value in row.items()}


def _first_value(row: Dict[str, str], candidates: Iterable[str]) -> str:
    for candidate in candidates:
        value = row.get(candidate.lower(), "").strip()
        if value:
            return value
    return ""


def _parse_price(raw_price: str) -> Optional[float]:
    if not raw_price:
        return None
    cleaned = raw_price.replace(",", "")
    match = re.search(r"(-?\d+(?:\.\d+)?)", cleaned)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _categorize_price(price: Optional[float]) -> str:
    if price is None:
        return ""
    if price < PRICE_BUDGET_MAX:
        return "Budget"
    if price < PRICE_MID_MAX:
        return "Mid"
    return "Premium"


def build_amazon_link(asin: str) -> str:
    return f"https://www.amazon.com/dp/{asin}/?tag={AMAZON_ASSOCIATE_TAG}"


def transform_row(row: Dict[str, str]) -> Optional[Dict[str, str]]:
    normalized = _normalize_keys(row)

    asin = _first_value(normalized, [
        "asin",
        "asin/isbn",
        "isbn",
        "product id",
        "productid",
        "item id",
    ])
    title = _first_value(normalized, [
        "title",
        "item name",
        "item",
        "product name",
        "description",
    ])
    comments = _first_value(normalized, ["comments", "comment", "notes"])
    price_raw = _first_value(normalized, [
        "price",
        "our price",
        "price (usd)",
        "current price",
        "listed price",
    ])

    if not asin or not title:
        return None

    price_value = _parse_price(price_raw)
    price_range = _categorize_price(price_value)

    return {
        "Category": CATEGORY,
        "Item_Name": title,
        "Tank_Size_Range": "",
        "Price_Range": price_range,
        "Notes": comments,
        "Amazon_Link": build_amazon_link(asin),
        "Chewy_Link": "",
        "Status": "Active",
    }


def convert() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")

    with INPUT_FILE.open("r", newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        rows = []
        for raw_row in reader:
            transformed = transform_row(raw_row)
            if transformed is not None:
                rows.append(transformed)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as target:
        fieldnames = [
            "Category",
            "Item_Name",
            "Tank_Size_Range",
            "Price_Range",
            "Notes",
            "Amazon_Link",
            "Chewy_Link",
            "Status",
        ]
        writer = csv.DictWriter(target, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    convert()
