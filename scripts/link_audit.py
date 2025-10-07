# scripts/link_audit.py
# Validate product links in gear CSVs by expanding short URLs and comparing page titles to Product_Name.
# Writes two reports:
#   reports/link_audit.csv  (detailed rows)
#   reports/link_audit.txt  (human-readable summary)

import csv, os, sys, time, re, argparse, json
from urllib.parse import urlparse
from pathlib import Path
from types import SimpleNamespace
from html import unescape
import urllib.request
import urllib.error

# Optional deps: requests + bs4. Fall back to stdlib when unavailable.
try:
    import requests  # type: ignore
except Exception:  # pragma: no cover - network sandbox lacks pip
    requests = None

try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:  # pragma: no cover - network sandbox lacks pip
    BeautifulSoup = None


AUDIT_DEFAULT_KEYS = [
    "Category",
    "Tank_Size",
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


class _UrlLibResponse(SimpleNamespace):
    """Lightweight response object for urllib fallback."""


class _UrlLibSession:
    def __init__(self):
        self.headers = {}

    def get(self, url, headers=None, allow_redirects=True, timeout=15):
        req_headers = dict(self.headers)
        if headers:
            req_headers.update(headers)
        request = urllib.request.Request(url, headers=req_headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as resp:
                final_url = resp.geturl()
                raw = resp.read()
                encoding = resp.headers.get_content_charset() or "utf-8"
                text = raw.decode(encoding, errors="replace")
                return _UrlLibResponse(url=final_url, text=text)
        except urllib.error.HTTPError as e:
            # mimic requests raising for non-2xx
            raise RuntimeError(f"HTTPError:{e.code}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"URLError:{e.reason}") from e


def _get_session():
    if requests is not None:
        return requests.Session()
    return _UrlLibSession()


def _extract_title(html):
    if BeautifulSoup is not None:
        soup = BeautifulSoup(html, "html.parser")
        tag = soup.find("title")
        return tag.get_text(strip=True) if tag else ""
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return unescape(match.group(1)).strip()

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def ensure_default_keys(row):
    for key in AUDIT_DEFAULT_KEYS:
        row.setdefault(key, "")
    return row


def ci_get(row, key, default=""):
    if not key:
        return default
    target = key.strip().casefold()
    for existing, value in row.items():
        if existing is None:
            continue
        if existing.strip().casefold() == target:
            return value
    return default


def read_csv_rows(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            rows.append(ensure_default_keys(dict(row)))
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
    candidates = [
        "gear_filtration.csv",
        "gear_lighting.csv",
        "gear_heating.csv",
        "data/gear_filtration.csv",
        "data/gear_lighting.csv",
        "data/gear_heating.csv",
    ]
    combined = []
    used = []
    for c in candidates:
        if Path(c).exists():
            combined.extend(read_csv_rows(c))
            used.append(c)
    if combined:
        return combined, "list:" + ",".join(used)
    raise FileNotFoundError("No input found. Provide --input CSV or ensure gear_master.csv or data/master_nav.json exists.")


def read_from_manifest(manifest_path, category_filter=None):
    path = Path(manifest_path)
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    entries = data.get("files") or data.get("entries") or []
    if not isinstance(entries, list):
        raise ValueError("Manifest must contain a list under 'files' or 'entries'.")

    rows = []
    used_sources = []
    base_dir = path.parent
    cat_filter = category_filter.strip().casefold() if category_filter else None

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        entry_category = (entry.get("category") or entry.get("id") or "").strip()
        if cat_filter and entry_category.strip().casefold() != cat_filter:
            continue
        csv_path = entry.get("path") or entry.get("file")
        if not csv_path:
            continue
        csv_path = Path(csv_path)
        if not csv_path.is_absolute():
            csv_path = (base_dir / csv_path).resolve()
        if not csv_path.exists():
            continue

        product_field = entry.get("product_field") or entry.get("title_field") or entry.get("product") or "Product_Name"
        url_field = entry.get("url_field") or entry.get("amazon_field") or entry.get("href_field") or "Amazon_Link"
        chewy_field = entry.get("chewy_field") or "Chewy_Link"
        notes_field = entry.get("notes_field") or entry.get("note_field")
        category_field = entry.get("category_field") or "Category"
        id_field = entry.get("id_field") or "product_id"

        with open(csv_path, newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, escapechar='\\')
            for raw in reader:
                row = {k: (v or "") for k, v in raw.items()}
                product_name = str(ci_get(row, product_field, "")).strip()
                url = str(ci_get(row, url_field, "")).strip()
                row_id = str(ci_get(row, id_field, "")).strip()
                category_value = str(ci_get(row, category_field, entry_category)).strip() or entry_category
                if row_id.startswith("#") or product_name.startswith("#") or url.startswith("#"):
                    continue
                if not (product_name or url):
                    continue
                notes_value = str(ci_get(row, notes_field, "")).strip() if notes_field else str(row.get("Notes", "")).strip()
                chewy_value = str(ci_get(row, chewy_field, "")).strip() if chewy_field else ""

                normalized = ensure_default_keys({})
                normalized["Category"] = category_value or entry_category
                normalized["Product_Name"] = product_name
                normalized["Amazon_Link"] = url
                normalized["Chewy_Link"] = chewy_value
                normalized["Notes"] = notes_value
                normalized["Source_List"] = entry.get("source") or entry_category or csv_path.name
                rows.append(normalized)
        used_sources.append(str(csv_path))

    if category_filter:
        return rows, f"manifest:{manifest_path} (category={category_filter})"
    return rows, f"manifest:{manifest_path}"

def expand_url(url, session, timeout=2):
    if not url:
        return "", "", "NO_URL"
    try:
        # follow redirects (amzn.to -> amazon.com)
        resp = session.get(url, headers={"User-Agent": UA}, allow_redirects=True, timeout=timeout)
        final_url = resp.url
        domain = urlparse(final_url).netloc.lower()
        return final_url, domain, "OK"
    except Exception as e:
        msg = str(e) or e.__class__.__name__
        return "", "", f"EXPAND_ERR:{msg}"

def fetch_title(url, session, timeout=3):
    if not url:
        return "", "NO_URL"
    try:
        resp = session.get(url, headers={"User-Agent": UA}, allow_redirects=True, timeout=timeout)
        html = resp.text
        # Amazon sometimes includes very long titles; <title> is still present.
        title = _extract_title(html)
        # Clean common suffix noise
        title = re.sub(r"Amazon\\.com\\s*:\\s*", "", title, flags=re.I)
        title = re.sub(r"\\s*:\\s*Amazon\\.com.*$", "", title, flags=re.I)
        return title, "OK"
    except Exception as e:
        msg = str(e) or e.__class__.__name__
        return "", f"TITLE_ERR:{msg}"

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
    ap.add_argument("--manifest", help="Path to manifest JSON describing category CSVs.")
    ap.add_argument("--category", help="Filter rows by category (case-insensitive).")
    ap.add_argument("--sleep", type=float, default=1.0, help="Delay between requests (seconds).")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of rows audited (0 = no limit).")
    args = ap.parse_args()

    if args.manifest:
        rows, src = read_from_manifest(args.manifest, category_filter=args.category)
    elif args.input:
        rows = read_csv_rows(args.input)
        src = f"file:{args.input}"
    else:
        rows, src = read_from_master_or_nav()

    if args.category and not args.manifest:
        target = args.category.strip().casefold()
        rows = [r for r in rows if (r.get("Category", "").strip().casefold() == target)]
        src = f"{src} [category={args.category}]"

    ensure_dir("reports")
    out_csv = "reports/link_audit.csv"
    out_txt = "reports/link_audit.txt"

    session = _get_session()
    session.headers.update({"User-Agent": UA})
    sleep_between = 0 if isinstance(session, _UrlLibSession) else max(args.sleep, 0)

    audited = []
    count = 0
    missing_sponsored = 0
    http_404 = 0

    for r in rows:
        if args.limit and count >= args.limit:
            break
        url = (r.get("Amazon_Link") or "").strip() or (r.get("Chewy_Link") or "").strip()
        prod = r.get("Product_Name","")
        cat  = r.get("Category","")
        if not url.lower().startswith("http"):
            missing_sponsored += 1
        final_url, domain, expand_status = expand_url(url, session)
        title, title_status = ("","NO_URL") if not final_url else fetch_title(final_url, session)
        status = guess_status(prod, title)
        if "HTTPError:404" in expand_status or "HTTPError:404" in title_status:
            http_404 += 1
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
        if sleep_between:
            time.sleep(sleep_between)

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
        f.write(f"Link Audit Source: {src}\n")
        f.write(f"Total audited: {len(audited)}\n")
        f.write(f"Missing sponsored: {missing_sponsored}\n")
        f.write(f"HTTP 404 errors: {http_404}\n")
        for k, v in sorted(by_cat.items()):
            f.write(f"  {k or 'Uncategorized'}: {v}\n")
        f.write("\nMISMATCH rows: {}\n".format(len(mismatches)))
        for a in mismatches[:25]:
            f.write(f"  - [{a['Category']}] {a['Product_Name']}\\n")
            f.write(f"    Title: {a['Page_Title'][:160]}\\n")
            f.write(f"    URL:   {a['Resolved_URL']}\\n")
        if len(mismatches) > 25:
            f.write(f"  ... and {len(mismatches)-25} more\\n")
        f.write("\nNO_TITLE rows: {}\n".format(len(no_titles)))
        f.write("\nUNKNOWN rows: {}\n".format(len(unknowns)))
        f.write("\nNotes: EXPAND_ERR = redirect/resolve failed; TITLE_ERR = fetch or parse title failed.\n")

    print(f"[OK] Wrote {out_csv} and {out_txt}")

if __name__ == "__main__":
    main()
