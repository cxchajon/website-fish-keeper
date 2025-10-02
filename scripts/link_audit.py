# scripts/link_audit.py
# Validate product links in gear CSVs by expanding short URLs and comparing page titles to Product_Name.
# Writes two reports:
#   reports/link_audit.csv  (detailed rows)
#   reports/link_audit.txt  (human-readable summary)

import csv, os, sys, time, re, argparse, json
from urllib.parse import urlparse
from pathlib import Path

# Optional deps: requests + bs4. If unavailable, instruct user.
try:
    import requests
    from bs4 import BeautifulSoup
except Exception as e:
    sys.stderr.write("This script requires 'requests' and 'beautifulsoup4' packages.\n")
    sys.stderr.write("Install with:  pip install requests beautifulsoup4\n")
    sys.exit(1)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def read_csv_rows(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            # Normalize missing keys
            for k in ["Category","Tank_Size","Product_Type","Product_Name","Use_Case","Recommended_Specs","Plant_Ready","Price_Range","Notes","Amazon_Link","Chewy_Link"]:
                row.setdefault(k, "")
            rows.append(row)
    return rows

def read_from_master_or_nav(master_csv="gear_master.csv", nav_json="data/master_nav.json"):
    if Path(master_csv).exists():
        return read_csv_rows(master_csv), f"master:{master_csv}"
    # else try master_nav.json
    if Path(nav_json).exists():
        with open(nav_json, "r", encoding="utf-8") as f:
            nav = json.load(f)
        combined = []
        for item in nav.get("files", []):
            p = item.get("path") or item.get("file") or ""
            if not p:
                continue
            p_path = Path(p.lstrip("/")) if p.startswith("/") else Path(p)
            if p_path.exists():
                combined.extend(read_csv_rows(p_path))
        return combined, f"nav:{nav_json}"
    # else, try common per-category files in ./ (optional)
    candidates = ["gear_filtration.csv", "gear_lighting.csv", "gear_heating.csv"]
    combined = []
    used = []
    for c in candidates:
        if Path(c).exists():
            combined.extend(read_csv_rows(c))
            used.append(c)
    if combined:
        return combined, "list:" + ",".join(used)
    raise FileNotFoundError("No input found. Provide --input CSV or ensure gear_master.csv or data/master_nav.json exists.")

def expand_url(url, session, timeout=15):
    if not url:
        return "", "", "NO_URL"
    try:
        # follow redirects (amzn.to -> amazon.com)
        resp = session.get(url, headers={"User-Agent": UA}, allow_redirects=True, timeout=timeout)
        final_url = resp.url
        domain = urlparse(final_url).netloc.lower()
        return final_url, domain, "OK"
    except Exception as e:
        return "", "", f"EXPAND_ERR:{e.__class__.__name__}"

def fetch_title(url, session, timeout=20):
    if not url:
        return "", "NO_URL"
    try:
        resp = session.get(url, headers={"User-Agent": UA}, allow_redirects=True, timeout=timeout)
        html = resp.text
        # Amazon sometimes includes very long titles; <title> is still present.
        soup = BeautifulSoup(html, "html.parser")
        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else ""
        # Clean common suffix noise
        title = re.sub(r"Amazon\\.com\\s*:\\s*", "", title, flags=re.I)
        title = re.sub(r"\\s*:\\s*Amazon\\.com.*$", "", title, flags=re.I)
        return title, "OK"
    except Exception as e:
        return "", f"TITLE_ERR:{e.__class__.__name__}"

def normalize(s):
    return re.sub(r"\\s+", " ", (s or "")).strip().casefold()

def fuzzy_match(a, b):
    # Lightweight check without external libs:
    # - exact after normalize
    # - substring either way
    # - token overlap threshold
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if na in nb or nb in na:
        return True
    atoks = set(re.findall(r"[a-z0-9+\\.]+", na))
    btoks = set(re.findall(r"[a-z0-9+\\.]+", nb))
    if not atoks or not btoks:
        return False
    overlap = len(atoks & btoks)
    return overlap >= max(2, min(len(atoks), len(btoks)) // 2)

def guess_status(product_name, page_title):
    if not product_name and not page_title:
        return "UNKNOWN"
    if not page_title:
        return "NO_TITLE"
    return "MATCH" if fuzzy_match(product_name, page_title) else "MISMATCH"

def ensure_dir(p):
    Path(p).mkdir(parents=True, exist_ok=True)

def main():
    ap = argparse.ArgumentParser(description="Audit product links and titles vs Product_Name.")
    ap.add_argument("--input", help="Path to CSV (optional if gear_master.csv or data/master_nav.json exists).")
    ap.add_argument("--sleep", type=float, default=1.0, help="Delay between requests (seconds).")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of rows audited (0 = no limit).")
    args = ap.parse_args()

    if args.input:
        rows = read_csv_rows(args.input)
        src = f"file:{args.input}"
    else:
        rows, src = read_from_master_or_nav()

    ensure_dir("reports")
    out_csv = "reports/link_audit.csv"
    out_txt = "reports/link_audit.txt"

    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    audited = []
    count = 0

    for r in rows:
        if args.limit and count >= args.limit:
            break
        url = (r.get("Amazon_Link") or "").strip() or (r.get("Chewy_Link") or "").strip()
        prod = r.get("Product_Name","")
        cat  = r.get("Category","")
        final_url, domain, expand_status = expand_url(url, session)
        title, title_status = ("","NO_URL") if not final_url else fetch_title(final_url, session)
        status = guess_status(prod, title)
        note_bits = []
        if expand_status != "OK": note_bits.append(expand_status)
        if title_status != "OK":  note_bits.append(title_status)
        notes = ";".join(note_bits)
        audited.append({
            "Category": cat,
            "Product_Name": prod,
            "Amazon_Link": url,
            "Resolved_URL": final_url,
            "Domain": domain,
            "Page_Title": title,
            "Match_Status": status,
            "Notes": notes
        })
        count += 1
        time.sleep(args.sleep)

    # write CSV
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Category","Product_Name","Amazon_Link","Resolved_URL","Domain","Page_Title","Match_Status","Notes"])
        w.writeheader()
        for a in audited:
            w.writerow(a)

    # write TXT summary
    mismatches = [a for a in audited if a["Match_Status"] == "MISMATCH"]
    no_titles  = [a for a in audited if a["Match_Status"] == "NO_TITLE"]
    unknowns   = [a for a in audited if a["Match_Status"] == "UNKNOWN"]
    by_cat = {}
    for a in audited:
        by_cat.setdefault(a["Category"], 0)
        by_cat[a["Category"]] += 1

    with open(out_txt, "w", encoding="utf-8") as f:
        f.write(f"Link Audit Source: {src}\\n")
        f.write(f"Total audited: {len(audited)}\\n")
        for k,v in sorted(by_cat.items()):
            f.write(f"  {k or 'Uncategorized'}: {v}\\n")
        f.write("\\nMISMATCH rows: {}\\n".format(len(mismatches)))
        for a in mismatches[:25]:
            f.write(f"  - [{a['Category']}] {a['Product_Name']}\\n")
            f.write(f"    Title: {a['Page_Title'][:160]}\\n")
            f.write(f"    URL:   {a['Resolved_URL']}\\n")
        if len(mismatches) > 25:
            f.write(f"  ... and {len(mismatches)-25} more\\n")
        f.write("\\nNO_TITLE rows: {}\\n".format(len(no_titles)))
        f.write("\\nUNKNOWN rows: {}\\n".format(len(unknowns)))
        f.write("\\nNotes: EXPAND_ERR = redirect/resolve failed; TITLE_ERR = fetch or parse title failed.\\n")

    print(f"[OK] Wrote {out_csv} and {out_txt}")

if __name__ == "__main__":
    main()
