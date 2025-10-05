#!/usr/bin/env python3
"""Sanitize ASIN values, rebuild Amazon links, and generate audit reports."""
from __future__ import annotations

import csv
import re
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"
AFFILIATE_TAG = "fishkeepingli-20"
CANONICAL_LINK_TEMPLATE = "https://www.amazon.com/dp/{asin}?tag=" + AFFILIATE_TAG
ASIN_PATTERN = re.compile(r"[A-Za-z0-9]{10}")
DP_EXTRACT_PATTERN = re.compile(r"/(?:dp|gp/product)/([A-Za-z0-9]{5,})")
NON_ASIN_CHARS = re.compile(r"[^A-Za-z0-9]")
PRICE_AVAILABILITY_PATTERN = re.compile(
    r"(\$[\d,.]+|\bprice(?:d|s|ing)?\b|\bavailability\b|\bavailable\b|\bunavailable\b|"
    r"\bin\s+stock\b|\bout\s+of\s+stock\b)",
    re.IGNORECASE,
)


@dataclass
class RowAudit:
    file: str
    product_name: str
    asin_before: str
    asin_after: str
    reason: str


@dataclass
class FileStats:
    path: Path
    rows_read: int = 0
    rows_written: int = 0
    duplicates_removed: int = 0
    links_fixed: int = 0
    invalid_asins: int = 0
    audits: List[RowAudit] = field(default_factory=list)


def clean_asin(value: Optional[str]) -> str:
    if not value:
        return ""
    cleaned = NON_ASIN_CHARS.sub("", value).upper()
    if not cleaned:
        return ""
    return cleaned[:10]


def is_valid_asin(asin: str) -> bool:
    return bool(asin) and len(asin) == 10 and asin.isalnum()


def extract_asin_from_link(link: Optional[str]) -> str:
    if not link:
        return ""
    match = DP_EXTRACT_PATTERN.search(link)
    if match:
        candidate = match.group(1)
        clean_candidate = clean_asin(candidate)
        if len(candidate) > 10 and clean_candidate and len(clean_candidate) == 10:
            return clean_candidate
        if is_valid_asin(clean_candidate):
            return clean_candidate
    # Fallback: search for any 10-char alphanumeric substring
    match = ASIN_PATTERN.search(link)
    if match:
        return clean_asin(match.group(0))
    return ""


def build_canonical_link(asin: str) -> str:
    return CANONICAL_LINK_TEMPLATE.format(asin=asin)


def strip_price_availability(text: Optional[str]) -> str:
    if not text:
        return ""
    cleaned = PRICE_AVAILABILITY_PATTERN.sub("", text)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\s*([;,])\s*", r"\1 ", cleaned)
    cleaned = cleaned.replace(" ,", ",").replace(" .", ".")
    return cleaned.strip(" ;,.")


def merge_notes(existing: str, incoming: str) -> str:
    seen = set()
    merged: List[str] = []
    for source in (existing, incoming):
        if not source:
            continue
        for part in source.split(';'):
            note = part.strip()
            if note and note not in seen:
                seen.add(note)
                merged.append(note)
    return "; ".join(merged)


def process_rows(rows: Iterable[Dict[str, str]], stats: FileStats, headers: List[str]) -> List[OrderedDict[str, str]]:
    dedup_map: Dict[str, OrderedDict[str, str]] = {}
    output: List[OrderedDict[str, str]] = []

    for row in rows:
        stats.rows_read += 1
        asin_before = (row.get("ASIN") or "").strip()
        link_before = (row.get("Amazon_Link") or "").strip()
        asin_source = asin_before or extract_asin_from_link(link_before)
        cleaned_asin = clean_asin(asin_source)
        asin_after = cleaned_asin if is_valid_asin(cleaned_asin) else ""

        notes_before = row.get("Notes", "")
        cleaned_notes = strip_price_availability(notes_before)

        issues: List[str] = []
        if asin_before and cleaned_asin and asin_before.upper() != cleaned_asin:
            issues.append("sanitized")
        if not asin_source:
            issues.append("missing_asin")
        elif not is_valid_asin(cleaned_asin):
            issues.append("invalid_asin")
        elif asin_before != asin_after:
            issues.append("normalized")

        if not asin_after:
            stats.invalid_asins += 1
        canonical_link = build_canonical_link(asin_after) if asin_after else ""
        if asin_after and canonical_link != link_before:
            stats.links_fixed += 1
        elif not asin_after and link_before:
            stats.links_fixed += 1

        ordered_row = OrderedDict((header, row.get(header, "")) for header in headers)
        ordered_row["ASIN"] = asin_after
        ordered_row["Amazon_Link"] = canonical_link
        ordered_row["Notes"] = cleaned_notes

        if issues:
            stats.audits.append(
                RowAudit(
                    file=str(stats.path.relative_to(DATA_DIR.parent)),
                    product_name=row.get("Product_Name", ""),
                    asin_before=asin_before,
                    asin_after=asin_after,
                    reason=",".join(sorted(set(issues))),
                )
            )

        if asin_after:
            existing = dedup_map.get(asin_after)
            if existing:
                stats.duplicates_removed += 1
                existing["Notes"] = merge_notes(existing.get("Notes", ""), cleaned_notes)
                for header in headers:
                    if header in {"Notes", "Amazon_Link", "ASIN"}:
                        continue
                    if not (existing.get(header) or "").strip() and (ordered_row.get(header) or "").strip():
                        existing[header] = ordered_row.get(header, "")
                continue
            dedup_map[asin_after] = ordered_row
        output.append(ordered_row)

    stats.rows_written = len(output)
    return output


def write_csv(path: Path, headers: List[str], rows: List[OrderedDict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def ensure_reports_dir() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def write_summary(stats_list: List[FileStats]) -> None:
    ensure_reports_dir()
    summary_path = REPORTS_DIR / "link_fix_summary.txt"
    lines: List[str] = ["Amazon Link Hardening Summary", "==============================", ""]
    total_read = total_written = total_dupes = total_fixed = total_invalid = 0
    for stats in stats_list:
        lines.append(f"File: {stats.path.relative_to(DATA_DIR.parent)}")
        lines.append(f"  Rows read: {stats.rows_read}")
        lines.append(f"  Rows written: {stats.rows_written}")
        lines.append(f"  Duplicates removed: {stats.duplicates_removed}")
        lines.append(f"  Links fixed: {stats.links_fixed}")
        lines.append(f"  Invalid/missing ASINs: {stats.invalid_asins}")
        lines.append("")
        total_read += stats.rows_read
        total_written += stats.rows_written
        total_dupes += stats.duplicates_removed
        total_fixed += stats.links_fixed
        total_invalid += stats.invalid_asins
    lines.append("Totals")
    lines.append(f"  Rows read: {total_read}")
    lines.append(f"  Rows written: {total_written}")
    lines.append(f"  Duplicates removed: {total_dupes}")
    lines.append(f"  Links fixed: {total_fixed}")
    lines.append(f"  Invalid/missing ASINs: {total_invalid}")
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_audit_report(stats_list: List[FileStats]) -> None:
    ensure_reports_dir()
    audit_path = REPORTS_DIR / "asin_issues.csv"
    headers = ["file", "Product_Name", "ASIN_before", "ASIN_after", "reason"]
    with audit_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        for stats in stats_list:
            for audit in stats.audits:
                writer.writerow([
                    audit.file,
                    audit.product_name,
                    audit.asin_before,
                    audit.asin_after,
                    audit.reason,
                ])


def write_samples(rows: List[OrderedDict[str, str]], headers: List[str]) -> None:
    ensure_reports_dir()
    sample_path = REPORTS_DIR / "samples_after.csv"
    with sample_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        for row in rows[:20]:
            writer.writerow(row)


def iter_target_files() -> List[Path]:
    master = DATA_DIR / "gear_master.csv"
    if master.exists():
        return [master]
    return sorted(DATA_DIR.glob("gear_*.csv"))


def main() -> None:
    target_files = iter_target_files()
    if not target_files:
        raise SystemExit("No target CSV files found.")

    stats_list: List[FileStats] = []
    all_rows: List[OrderedDict[str, str]] = []

    for path in target_files:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            headers = reader.fieldnames or []
            if not headers:
                continue
            stats = FileStats(path=path)
            processed = process_rows(reader, stats, headers)
            write_csv(path, headers, processed)
            stats_list.append(stats)
            all_rows.extend(processed)

    write_summary(stats_list)
    write_audit_report(stats_list)
    if all_rows:
        write_samples(all_rows, list(all_rows[0].keys()))


if __name__ == "__main__":
    main()
