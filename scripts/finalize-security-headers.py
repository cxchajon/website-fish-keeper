#!/usr/bin/env python3
"""Finalize security headers verification audit data."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = REPO_ROOT / "gha-security-headers-result.json"
DOCS_DIR = REPO_ROOT / "docs" / "security"
CHANNEL_LOG = REPO_ROOT / "docs" / "CHANNEL_LOG.md"


def load_result() -> dict:
    if not SOURCE_FILE.exists():
        print(
            "gha-security-headers-result.json not found. Run the GitHub Actions workflow first.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    with SOURCE_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_audit_file(result: dict, today_utc: str) -> Path:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    target = DOCS_DIR / f"security-audit-{today_utc}-gha.json"
    with target.open("w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")
    return target


def append_channel_log(result: dict, today_utc: str) -> None:
    status = result.get("status", "unknown").lower()
    verified_at = result.get("verified_at_utc", "unknown")
    icon = "✅" if status == "verified" else "❌"
    outcome = "succeeded" if status == "verified" else "failed"

    heading = f"## [{today_utc}] — Security Headers Verification (External Runner Added)"
    message_lines = [
        heading,
        f"{icon} GitHub Actions verification {outcome} at {verified_at}.",
        "Outbound HTTPS blocked in this environment. Added GitHub Action to verify headers at edge and commit report.",
        "",
    ]
    block = "\n".join(message_lines)

    existing = CHANNEL_LOG.read_text(encoding="utf-8") if CHANNEL_LOG.exists() else ""

    pattern = re.compile(
        rf"{re.escape(heading)}(?:\n.*?)(?:\n\n|\Z)",
        flags=re.DOTALL,
    )

    if pattern.search(existing):
        updated = pattern.sub(block + ("\n" if not block.endswith("\n") else ""), existing)
    else:
        updated = existing
        if updated and not updated.endswith("\n"):
            updated += "\n"
        updated += block

    if not updated.endswith("\n"):
        updated += "\n"

    CHANNEL_LOG.write_text(updated, encoding="utf-8")


def main() -> None:
    result = load_result()
    today_utc = datetime.now(timezone.utc).date().isoformat()
    audit_path = write_audit_file(result, today_utc)
    append_channel_log(result, today_utc)
    print(f"Wrote {audit_path} and appended CHANNEL_LOG entry.")


if __name__ == "__main__":
    main()
