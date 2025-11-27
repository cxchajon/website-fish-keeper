"""Audit script for verifying legal links placement above the footer."""
from __future__ import annotations

from pathlib import Path
from typing import List

PAGES: List[Path] = [
    Path("index.html"),
    Path("store.html"),
    Path("submit-your-tank.html"),
    Path("stocking-advisor.html"),
    Path("gear/index.html"),
    Path("params.html"),
    Path("about.html"),
    Path("contact-feedback.html"),
    Path("terms.html"),
    Path("privacy-legal.html"),
    Path("cookie-settings.html"),
    Path("trust-security.html"),
    Path("copyright-dmca.html"),
    Path("media.html"),
    Path("pages/university.html"),
    Path("pages/community-video-picks.html"),
    Path("university/index.html"),
    Path("journal.html"),
    Path("journal-dashboard.html"),
    Path("cycling-coach/index.html"),
    Path("blogs/index.html"),
    Path("blogs/betta-fish-in-a-community-tank.html"),
    Path("blogs/nitrogen-cycle/index.html"),
    Path("blogs/purigen/index.html"),
    Path("blogs/blackbeard/index.html"),
    Path("404.html"),
]

# Remove duplicates while preserving order
seen = set()
ordered_pages: List[Path] = []
for page in PAGES:
    if page not in seen:
        ordered_pages.append(page)
        seen.add(page)
PAGES = ordered_pages

LINK_TARGETS = [
    Path("privacy-legal.html"),
    Path("terms.html"),
    Path("contact-feedback.html"),
]

def build_report() -> str:
    footer_html = Path("footer.html").read_text(encoding="utf-8")
    footer_has_dupes = any(f'href="/{target.as_posix()}"' in footer_html for target in LINK_TARGETS)

    headers = [
        "Page",
        "Above-Footer Present",
        "Footer Duplication",
        "Raw HTML Visible",
        "Legal Files Exist",
        "A11y Label",
        "Result",
    ]
    rows = [" | ".join(headers), " | ".join(["---"] * len(headers))]
    passes = 0

    legal_files_exist = all(target.exists() for target in LINK_TARGETS)

    for page in PAGES:
        html = page.read_text(encoding="utf-8")
        page_label = f"/{page.as_posix()}"

        footer_idx = html.find('<div id="site-footer"')
        section_idx = html.find('<section class="legal-links" aria-label="Site legal links"')
        above_footer = section_idx != -1 and footer_idx != -1 and section_idx < footer_idx

        raw_visible = all(f'href="/{target.as_posix()}"' in html for target in LINK_TARGETS)

        aria_present = 'aria-label="Site legal links"' in html and 'aria-label="Site legal links (noscript)"' in html

        footer_dup = "No" if not footer_has_dupes else "Yes"

        result_ok = all([above_footer, not footer_has_dupes, raw_visible, legal_files_exist, aria_present])
        result_icon = "✅" if result_ok else "❌"
        if result_ok:
            passes += 1

        row = " | ".join(
            [
                page_label,
                "Yes" if above_footer else "No",
                footer_dup,
                "Yes" if raw_visible else "No",
                "Yes" if legal_files_exist else "No",
                "Yes" if aria_present else "No",
                result_icon,
            ]
        )
        rows.append(row)

    failures = len(PAGES) - passes
    rows.append(
        " | ".join(
            [
                "Totals",
                f"{len(PAGES)} pages",
                "-",
                "-",
                "-",
                "-",
                f"Pass: {passes} / Fail: {failures}",
            ]
        )
    )

    return "\n".join(rows)


def main() -> None:
    print(build_report())


if __name__ == "__main__":
    main()
