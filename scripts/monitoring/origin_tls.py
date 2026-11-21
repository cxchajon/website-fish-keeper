#!/usr/bin/env python3
"""Inspect GitHub Pages origin TLS using Cloudflare DNS configuration, without proxying."""
import datetime as dt
import hashlib
import ipaddress
import json
import os
import socket
import ssl
import sys
import urllib.parse
import urllib.request

HOSTS = ("thetankguide.com", "www.thetankguide.com")
THRESHOLDS = (30, 14, 7, 3, 1)


def api(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": "ttg-origin-monitor", **(headers or {})})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def cf_records(zone, token):
    records, page = [], 1
    while True:
        url = f"https://api.cloudflare.com/client/v4/zones/{urllib.parse.quote(zone, safe='')}/dns_records?per_page=100&page={page}"
        data = api(url, {"Authorization": f"Bearer {token}"})
        if not data.get("success"):
            raise RuntimeError("Cloudflare DNS API reported failure")
        records.extend(data["result"])
        if page >= data.get("result_info", {}).get("total_pages", 1):
            return records
        page += 1


def configured_addresses(records, allowed):
    apex = [r for r in records if r.get("name") == HOSTS[0] and r.get("type") in ("A", "AAAA")]
    www = [r for r in records if r.get("name") == HOSTS[1] and r.get("type") == "CNAME"]
    if not apex or len(www) != 1 or www[0].get("content", "").rstrip(".").lower() != "cxchajon.github.io":
        raise ValueError("Unexpected origin DNS configuration; review before relying on this monitor")
    ips = sorted({str(ipaddress.ip_address(r["content"])) for r in apex})
    networks = [ipaddress.ip_network(n) for n in allowed]
    if any(not any(ipaddress.ip_address(ip) in net for net in networks) for ip in ips):
        raise ValueError("An origin address is not in GitHub's published Pages ranges")
    return ips


def inspect(ip, hostname, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    context = ssl.create_default_context()
    with socket.create_connection((ip, 443), timeout=12) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as conn:
            cert = conn.getpeercert()
            der = conn.getpeercert(binary_form=True)
    expiry = dt.datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=dt.timezone.utc)
    return {"hostname": hostname, "ip": ip, "subject": cert.get("subject"), "issuer": cert.get("issuer"),
            "not_before": cert.get("notBefore"), "not_after": cert.get("notAfter"),
            "sans": cert.get("subjectAltName"), "sha256": hashlib.sha256(der).hexdigest(),
            "days_remaining": (expiry - now).total_seconds() / 86400, "trusted": True}


def main():
    token, zone = os.getenv("CF_DNS_READ_TOKEN"), os.getenv("CF_ZONE_ID")
    if not token or not zone:
        raise RuntimeError("CF_DNS_READ_TOKEN and CF_ZONE_ID are required; see private operational setup")
    records = cf_records(zone, token)
    meta = api("https://api.github.com/meta")
    ips = configured_addresses(records, meta["pages"])
    results, errors = [], []
    for host in HOSTS:
        for ip in ips:
            try:
                results.append(inspect(ip, host))
            except (OSError, ssl.SSLError, ValueError) as exc:
                errors.append({"hostname": host, "ip": ip, "error": str(exc)})
    for host in HOSTS:
        fingerprints = {r["sha256"] for r in results if r["hostname"] == host}
        if len(fingerprints) > 1:
            errors.append({"hostname": host, "error": "Inconsistent certificates across configured addresses"})
    report = {"checked_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "results": results, "errors": errors}
    print(json.dumps(report, indent=2))
    warnings = [r for r in results if r["days_remaining"] <= 30]
    if warnings:
        print("::warning::Origin certificate expires within 30 days; verify notification delivery and renewal", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Origin monitoring failed: {exc}", file=sys.stderr)
        sys.exit(1)

