#!/usr/bin/env python3
"""Info icon placement audit utility."""
from __future__ import annotations

import csv
import datetime as dt
import json
import re
import sys
from dataclasses import dataclass
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

SKIP_TAGS = {"script", "style", "noscript", "template"}
WINDOW_WORDS = 10


@dataclass
class TermInfo:
    term: str
    intent: str
    recommended_page: str
    tooltip: str


@dataclass
class TextNode:
    text: str
    tag: str
    attrs: Dict[str, str]
    path: str
    source: str  # 'text' or 'alt'


class TextExtractor(HTMLParser):
    """Collects visible text and image alternative text."""

    def __init__(self) -> None:
        super().__init__()
        self.stack: List[Tuple[str, Dict[str, str]]] = []
        self.nodes: List[TextNode] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attr_dict = self._normalize_attrs(attrs)
        self.stack.append((tag, attr_dict))
        if tag == "img":
            self._capture_alt(tag, attr_dict)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_startendtag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attr_dict = self._normalize_attrs(attrs)
        if tag == "img":
            self._capture_alt(tag, attr_dict)

    def handle_data(self, data: str) -> None:
        if not data or not data.strip():
            return
        if any(tag in SKIP_TAGS for tag, _ in self.stack):
            return
        current_tag, current_attrs = self.stack[-1] if self.stack else ("document", {})
        node = TextNode(
            text=data,
            tag=current_tag,
            attrs=current_attrs,
            path=self._build_path(),
            source="text",
        )
        self.nodes.append(node)

    def _capture_alt(self, tag: str, attrs: Dict[str, str]) -> None:
        alt = attrs.get("alt")
        if alt and alt.strip():
            node = TextNode(
                text=alt,
                tag=tag,
                attrs=attrs,
                path=self._build_path(include_current=(tag, attrs)),
                source="alt",
            )
            self.nodes.append(node)

    def _normalize_attrs(self, attrs: Iterable[Tuple[str, Optional[str]]]) -> Dict[str, str]:
        normalized: Dict[str, str] = {}
        for key, value in attrs:
            if value is None:
                continue
            if key == "class":
                normalized[key] = " ".join(value.split())
            else:
                normalized[key] = value
        return normalized

    def _build_path(self, include_current: Optional[Tuple[str, Dict[str, str]]] = None) -> str:
        parts = [self._format_tag(tag, attrs) for tag, attrs in self.stack]
        if include_current:
            parts.append(self._format_tag(include_current[0], include_current[1]))
        return " > ".join(parts)

    def _format_tag(self, tag: str, attrs: Dict[str, str]) -> str:
        ident = tag
        if not attrs:
            return ident
        if attrs.get("id"):
            ident += f"#{attrs['id']}"
        elif attrs.get("class"):
            classes = attrs["class"].split()
            ident += "." + ".".join(classes[:2])
        elif attrs.get("data-section"):
            ident += f"[data-section={attrs['data-section']}]"
        return ident


def load_terms(csv_path: Path) -> Dict[str, TermInfo]:
    if not csv_path.is_file():
        raise FileNotFoundError(f"Missing term priority CSV: {csv_path}")
    lookup: Dict[str, TermInfo] = {}
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            term = row["term"].strip()
            intent = row.get("intent", "").strip()
            recommended = row.get("recommended_page", "").strip()
            tooltip = row.get("tooltip", "").strip()
            if not term:
                continue
            lookup[term.lower()] = TermInfo(term=term, intent=intent, recommended_page=recommended, tooltip=tooltip)
    return lookup


def compute_checksums(files: Iterable[Path]) -> Dict[str, str]:
    checksums: Dict[str, str] = {}
    for file_path in files:
        if not file_path.is_file():
            continue
        digest = sha256(file_path.read_bytes()).hexdigest()
        checksums[str(file_path)] = digest
    return checksums


def update_preflight_snapshot(repo_root: Path, target_files: Iterable[Path]) -> str:
    snapshot = compute_checksums(target_files)
    timestamp = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    preflight_path = repo_root / "_codex_sync" / "preflight_checksums.json"
    if not preflight_path.is_file():
        raise FileNotFoundError("Expected preflight_checksums.json")
    with preflight_path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    data[f"infoicon_audit_preflight_{timestamp}"] = snapshot
    with preflight_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, sort_keys=True)
    return timestamp


def describe_location(path: str) -> str:
    if not path:
        return "document"
    segments = path.split(" > ")
    trimmed = segments[-3:]
    return " > ".join(trimmed)


def extract_context(text: str, term: str, window: int = WINDOW_WORDS) -> str:
    words = text.split()
    term_words = term.split()
    lowered_words = [w.lower() for w in words]
    target = [w.lower() for w in term_words]
    for index in range(len(words)):
        if lowered_words[index:index + len(target)] == target:
            start = max(0, index - window)
            end = min(len(words), index + len(target) + window)
            excerpt = " ".join(words[start:end])
            return excerpt.strip()
    # fallback to substring window
    lowered_text = text.lower()
    pos = lowered_text.find(term.lower())
    if pos == -1:
        cleaned = " ".join(words)
        return cleaned[:200].strip()
    start_char = max(0, pos - 120)
    end_char = min(len(text), pos + len(term) + 120)
    snippet = text[start_char:end_char].strip()
    return snippet


def load_inventory(repo_root: Path) -> List[Dict[str, str]]:
    inventory_path = repo_root / "_codex_sync" / "site_audit" / "pages_inventory.json"
    with inventory_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def parse_html_text(file_path: Path) -> List[TextNode]:
    parser = TextExtractor()
    parser.feed(file_path.read_text(encoding="utf-8"))
    parser.close()
    return parser.nodes


def ensure_orphan_file(repo_root: Path) -> None:
    orphan_path = repo_root / "_codex_sync" / "site_audit" / "pages_orphans.json"
    if not orphan_path.exists():
        orphan_path.write_text("[]\n", encoding="utf-8")
    else:
        content = orphan_path.read_text(encoding="utf-8").strip()
        if not content:
            orphan_path.write_text("[]\n", encoding="utf-8")


def update_codex_status(repo_root: Path) -> None:
    status_path = repo_root / "_codex_sync" / "codex_status.json"
    with status_path.open(encoding="utf-8") as handle:
        status_data = json.load(handle)
    status_data["last_result"] = "infoicon_audit"
    status_data["status"] = "ready_for_tooltip_injection"
    status_path.write_text(json.dumps(status_data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def append_activity_log(repo_root: Path, pages_scanned: int, matches: int) -> None:
    log_path = repo_root / "_codex_sync" / "codex_activity_log.md"
    timestamp = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    line = f"INFOICON_AUDIT {timestamp} • pages_scanned={pages_scanned} • matches={matches} • ready_for_injection\n"
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(line)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    csv_path = repo_root / "aquarium_search_terms_infoicon_priority.csv"
    inventory = load_inventory(repo_root)
    term_lookup = load_terms(csv_path)
    audit_dir = repo_root / "_codex_sync" / "infoicons_audit"
    audit_dir.mkdir(parents=True, exist_ok=True)

    target_files = [repo_root / entry["file"] for entry in inventory if entry["file"].endswith(".html")]
    preflight_timestamp = update_preflight_snapshot(repo_root, target_files)

    results: List[Dict[str, object]] = []
    missing: List[Dict[str, object]] = []
    csv_rows: List[Dict[str, str]] = []
    pages_scanned = 0
    total_matches = 0

    for entry in inventory:
        file_name = entry["file"]
        if not file_name.endswith(".html"):
            continue
        file_path = repo_root / file_name
        if not file_path.is_file():
            continue
        pages_scanned += 1
        nodes = parse_html_text(file_path)
        matched_terms: Dict[str, Dict[str, object]] = {}

        for node_index, node in enumerate(nodes):
            text_lower = node.text.lower()
            for key, info in term_lookup.items():
                if key in matched_terms:
                    continue
                if key in text_lower:
                    context = extract_context(node.text, info.term)
                    location = describe_location(node.path)
                    match_entry = {
                        "page_path": entry["url_path"],
                        "file": file_name,
                        "term": info.term,
                        "intent": info.intent,
                        "context_excerpt": context,
                        "recommended_icon_location": location,
                        "tooltip": info.tooltip,
                        "source": node.source,
                        "node_index": node_index,
                        "preflight_timestamp": preflight_timestamp,
                    }
                    matched_terms[key] = match_entry
                    results.append(match_entry)
                    csv_rows.append({
                        "page_path": entry["url_path"],
                        "file": file_name,
                        "term": info.term,
                        "status": "present",
                        "context_excerpt": context,
                        "recommended_icon_location": location,
                        "tooltip": info.tooltip,
                        "intent": info.intent,
                    })
        total_matches += len(matched_terms)

        page_missing: List[Dict[str, str]] = []
        for key, info in term_lookup.items():
            if info.recommended_page and info.recommended_page != file_name:
                continue
            if key in matched_terms:
                continue
            suggestion = f"Add tooltip near first mention or summary of '{info.term}' on {file_name}."
            entry_missing = {
                "term": info.term,
                "intent": info.intent,
                "tooltip": info.tooltip,
                "recommended_icon_location": suggestion,
            }
            page_missing.append(entry_missing)
            csv_rows.append({
                "page_path": entry["url_path"],
                "file": file_name,
                "term": info.term,
                "status": "missing",
                "context_excerpt": "",
                "recommended_icon_location": suggestion,
                "tooltip": info.tooltip,
                "intent": info.intent,
            })
        if page_missing:
            missing.append({
                "page_path": entry["url_path"],
                "file": file_name,
                "missing_terms": page_missing,
            })

    matches_path = audit_dir / "infoicon_matches.json"
    missing_path = audit_dir / "infoicon_missing.json"
    summary_path = audit_dir / "infoicon_summary.md"
    csv_path_out = audit_dir / "infoicon_recommendations.csv"

    matches_path.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    missing_path.write_text(json.dumps(missing, indent=2) + "\n", encoding="utf-8")

    total_missing_terms = sum(len(entry["missing_terms"]) for entry in missing)
    summary_lines = [
        "# Info Icon Audit Summary",
        "",
        f"- Generated: {dt.datetime.utcnow().replace(microsecond=0).isoformat()}Z",
        f"- Preflight snapshot: {preflight_timestamp}",
        f"- Pages scanned: {pages_scanned}",
        f"- Terms matched: {total_matches}",
        f"- Relevant terms missing: {total_missing_terms}",
        "",
        "## Priority Recommendations",
    ]

    # Sort matches by significance (present first by order of detection)
    prioritized = sorted(results, key=lambda item: (item["file"], item["node_index"]))
    seen_pairs = set()
    for entry in prioritized:
        pair_key = (entry["file"], entry["term"])
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)
        summary_lines.append(
            f"- **{entry['term']}** on `{entry['file']}` → tooltip near `{entry['recommended_icon_location']}`."
        )
    if not prioritized:
        summary_lines.append("- No existing matches located; focus on missing placements.")

    if missing:
        summary_lines.append("")
        summary_lines.append("## Missing but Relevant")
        for entry in missing:
            terms = ", ".join(term["term"] for term in entry["missing_terms"])
            summary_lines.append(f"- `{entry['file']}` missing: {terms}")

    summary_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    with csv_path_out.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "page_path",
            "file",
            "term",
            "status",
            "context_excerpt",
            "recommended_icon_location",
            "tooltip",
            "intent",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in csv_rows:
            writer.writerow(row)

    ensure_orphan_file(repo_root)
    update_codex_status(repo_root)
    append_activity_log(repo_root, pages_scanned, total_matches)

    return 0


if __name__ == "__main__":
    sys.exit(main())
