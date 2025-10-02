import sys, subprocess, os, csv, argparse, shutil, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
REPORTS = ROOT / "reports"
AUDITOR = SCRIPTS / "link_audit.py"

PACKAGE_TO_MODULE = {
    "beautifulsoup4": "bs4",
}


def pip_install_if_missing(pkgs):
    for pkg in pkgs:
        module_name = PACKAGE_TO_MODULE.get(pkg, pkg)
        try:
            __import__(module_name)
        except Exception:
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])


def run_auditor(input_csv=None, sleep=0.7, limit=0):
    if not AUDITOR.exists():
        raise SystemExit(f"Missing auditor at {AUDITOR}. Make sure scripts/link_audit.py is in the repo.")
    cmd = [sys.executable, str(AUDITOR)]
    if input_csv:
        cmd += ["--input", input_csv]
    if sleep is not None:
        cmd += ["--sleep", str(sleep)]
    if limit:
        cmd += ["--limit", str(limit)]
    subprocess.check_call(cmd)


def print_mismatches():
    path = REPORTS / "link_audit.csv"
    if not path.exists():
        raise SystemExit(f"No audit CSV found at {path}. Did the auditor run?")
    mismatches = []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            if (row.get("Match_Status") or "").upper() == "MISMATCH":
                mismatches.append(row)
    print(f"\n=== MISMATCH SUMMARY ({len(mismatches)} rows) ===")
    for i, m in enumerate(mismatches, 1):
        pn = (m.get("Product_Name") or "").strip()
        ttl = (m.get("Page_Title") or "").strip().replace("\n", " ")
        url = (m.get("Resolved_URL") or m.get("Amazon_Link") or "").strip()
        cat = (m.get("Category") or "").strip()
        print(f"\n#{i} [{cat}] {pn}\nTitle: {ttl[:200]}\nURL:   {url}")
    if not mismatches:
        print("\n(no mismatches found 🎉)")


def main():
    ap = argparse.ArgumentParser(description="Run link audit and print only mismatches.")
    ap.add_argument("--input", help="Audit a specific CSV (e.g., gear_lighting.csv). If omitted, auto-detect gear_master.csv or master_nav.json.")
    ap.add_argument("--sleep", type=float, default=0.7, help="Delay between requests (seconds).")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of rows (0 = all).")
    args = ap.parse_args()

    # Ensure deps for link_audit.py
    pip_install_if_missing(["requests", "beautifulsoup4"])

    # Ensure reports dir exists
    REPORTS.mkdir(parents=True, exist_ok=True)

    # Run auditor, then show only mismatches
    run_auditor(input_csv=args.input, sleep=args.sleep, limit=args.limit)
    print_mismatches()


if __name__ == "__main__":
    main()
