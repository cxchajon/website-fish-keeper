#!/usr/bin/env python3
"""Static verification for trim recheck."""
from __future__ import annotations

import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "_codex_sync" / "trim"
CHECKSUM_PATH = REPO_ROOT / "_codex_sync" / "recheck_checksums.json"
PRECHECK_PATH = REPO_ROOT / "_codex_sync" / "preflight_checksums.json"
STATIC_REPORT_PATH = OUTPUT_DIR / "recheck_static.json"

REMOVED_ASSETS = [
    "assets/media/library/books/blogs.png",
    "assets/media/community/submit-tank-placeholder.svg",
    "assets/icons/favicon.png",
    "assets/icons/footer-x.svg",
]

PAGES_TO_CHECK = {
    "index.html": "/",
    "gear/index.html": "/gear/",
    "stocking-advisor.html": "/stocking-advisor.html",
    "params.html": "/params.html",
    "media.html": "/media.html",
    "about.html": "/about.html",
}

BOX_SIZING_LIMIT = 1


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def compute_checksums(files: Iterable[str]) -> Dict[str, str]:
    output: Dict[str, str] = {}
    for rel in files:
        path = REPO_ROOT / rel
        if not path.is_file():
            continue
        output[rel] = sha256_file(path)
    return output


def build_scope_map(all_checksums: Dict[str, str], scopes: Iterable[str]) -> Dict[str, Dict[str, str]]:
    scoped: Dict[str, Dict[str, str]] = {"/": dict(sorted(all_checksums.items()))}
    for scope in scopes:
        if scope == "/":
            continue
        prefix = scope.lstrip("/")
        scoped[scope] = {
            rel: checksum
            for rel, checksum in scoped["/"].items()
            if rel == prefix or rel.startswith(f"{prefix}/")
        }
    return scoped


def load_preflight_scopes() -> Tuple[Dict[str, Dict[str, str]], List[str]]:
    with PRECHECK_PATH.open("r", encoding="utf-8") as handle:
        preflight = json.load(handle)
    scopes = list(preflight.keys())
    return preflight, scopes


def git_ls_files() -> List[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    files = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return files


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def diff_counts(old: Dict[str, str], new: Dict[str, str]) -> Counter:
    old_keys = set(old.keys())
    new_keys = set(new.keys())
    added = new_keys - old_keys
    removed = old_keys - new_keys
    changed = {key for key in (old_keys & new_keys) if old[key] != new[key]}
    return Counter({"added": len(added), "removed": len(removed), "changed": len(changed)})


def asset_absent(path: str) -> bool:
    return not (REPO_ROOT / path).exists()


def find_references(term: str) -> List[str]:
    matches: List[str] = []
    allowed_suffixes = {".html", ".htm", ".css", ".js", ".mjs", ".ts", ".tsx", ".jsx"}
    excluded_parts = {"_codex_sync", "node_modules", ".git", "dist", "logs"}
    for file_path in REPO_ROOT.rglob("*"):
        if not file_path.is_file():
            continue
        if any(part in excluded_parts for part in file_path.parts):
            continue
        if file_path.suffix.lower() not in allowed_suffixes:
            continue
        try:
            text = file_path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if term in text:
            matches.append(str(file_path.relative_to(REPO_ROOT)))
    return matches


def check_utilities_imports() -> Dict[str, Dict[str, object]]:
    results: Dict[str, Dict[str, object]] = {}
    util_exists = (REPO_ROOT / "assets/css/utilities.css").is_file()
    for rel_path, url in PAGES_TO_CHECK.items():
        page_path = REPO_ROOT / rel_path
        if not page_path.is_file():
            results[url] = {
                "page_exists": False,
                "import_count": 0,
                "box_sizing_count": 0,
                "status": False,
            }
            continue
        try:
            text = page_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = page_path.read_text(encoding="latin-1")
        import_count = text.count("utilities.css")
        box_count = text.count("box-sizing")
        status = util_exists and import_count == 1 and box_count <= BOX_SIZING_LIMIT
        results[url] = {
            "page_exists": True,
            "import_count": import_count,
            "box_sizing_count": box_count,
            "status": status,
        }
    return {"utilities_exists": util_exists, "pages": results}


def check_tooltip_modules() -> Dict[str, object]:
    tooltip_path = REPO_ROOT / "js/ui/tooltip.js"
    params_path = REPO_ROOT / "js/params.js"
    tooltip_ok = tooltip_path.is_file()
    params_ok = params_path.is_file()

    tooltip_exports = False
    params_clean = False
    if tooltip_ok:
        text = tooltip_path.read_text(encoding="utf-8")
        tooltip_exports = "export function initInfoTooltips" in text and "export function closeAllInfoTooltips" in text
    if params_ok:
        text = params_path.read_text(encoding="utf-8")
        tooltip_lines = [
            line
            for line in text.splitlines()
            if "tooltip" in line.lower()
            and "tooltip.js" not in line.lower()
            and "initinfotooltips" not in line.lower()
            and "closeallinfotooltips" not in line.lower()
        ]
        params_clean = not tooltip_lines
    return {
        "tooltip_module_present": tooltip_ok,
        "tooltip_exports": tooltip_exports,
        "params_module_present": params_ok,
        "params_imports_only": params_clean,
    }


def check_redirect_rule() -> bool:
    redirects_path = REPO_ROOT / "_redirects"
    if not redirects_path.is_file():
        return False
    text = redirects_path.read_text(encoding="utf-8")
    return "/404.html" in text and "/ 301" in text.split("/404.html", 1)[1]


def check_sitemap() -> Dict[str, object]:
    sitemap_path = REPO_ROOT / "sitemap.xml"
    if not sitemap_path.is_file():
        return {"present": False, "has_university": False, "legacy_conflicts": []}
    text = sitemap_path.read_text(encoding="utf-8")
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return {"present": True, "has_university": False, "legacy_conflicts": ["parse_error"]}
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [
        (loc.text or "").strip()
        for loc in root.findall("sm:url/sm:loc", namespace)
    ]
    has_university = any(loc.endswith("/pages/university.html") for loc in locs)
    legacy_terms = [
        "copyright.html",
        "privacy.html",
        "terms-of-service.html",
        "dmca.html",
        "legal.html",
    ]
    legacy_conflicts = [term for term in legacy_terms if any(loc.endswith(f"/{term}") for loc in locs)]
    return {
        "present": True,
        "has_university": has_university,
        "legacy_conflicts": legacy_conflicts,
    }


def main() -> None:
    ensure_output_dir()
    preflight, scopes = load_preflight_scopes()
    tracked_files = git_ls_files()
    checksums = compute_checksums(tracked_files)
    scoped_checksums = build_scope_map(checksums, scopes)
    with CHECKSUM_PATH.open("w", encoding="utf-8") as handle:
        json.dump(scoped_checksums, handle, indent=2, sort_keys=True)
        handle.write("\n")

    counts = diff_counts(preflight.get("/", {}), scoped_checksums.get("/", {}))
    print(f"Checksum diff counts: added={counts['added']} removed={counts['removed']} changed={counts['changed']}")

    removed_results = {}
    assets_absent = True
    for asset in REMOVED_ASSETS:
        exists = not asset_absent(asset)
        refs = find_references(asset)
        removed_results[asset] = {
            "exists": exists,
            "references": refs,
        }
        if exists or refs:
            assets_absent = False

    utilities_result = check_utilities_imports()
    tooltip_result = check_tooltip_modules()
    redirect_ok = check_redirect_rule()
    sitemap_result = check_sitemap()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "checksums_diff": dict(counts),
        "removed_assets_absent": assets_absent,
        "removed_assets": removed_results,
        "utilities_check": utilities_result,
        "tooltip_modules": tooltip_result,
        "redirect_rule_present": redirect_ok,
        "sitemap": sitemap_result,
    }

    with STATIC_REPORT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")


if __name__ == "__main__":
    main()
