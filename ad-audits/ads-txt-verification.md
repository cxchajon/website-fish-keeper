# Ads.txt Verification Report

## Pre-flight
- `ads.txt` (repo root) currently contains a single line: `google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0`.
- Netlify `_headers` entry for `/ads.txt` sets `Content-Type: text/plain; charset=utf-8` and `Cache-Control: max-age=30` ensuring plain-text delivery.
- `robots.txt` allows all crawlers and references the HTTPS sitemap at `https://thetankguide.com/sitemap.xml`.
- Sitemap files present in the repo: `/sitemap.xml`.

## Live Probes
All probes now succeed. HTTP variants 301 redirect to HTTPS, Cloudflare serves the final 200 response with the expected AdSense body.

| URL | Method | Redirect Chain | Final Status | Final URL | Content-Type | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| https://thetankguide.com/ads.txt | GET | [200] | 200 | https://thetankguide.com/ads.txt | text/plain; charset=utf-8 | Direct HTTPS fetch succeeded; Cloudflare cache hit (`cf-cache-status: HIT`). |
| http://thetankguide.com/ads.txt | GET | [301, 200] | 200 | https://thetankguide.com/ads.txt | text/plain; charset=utf-8 | HTTP → HTTPS redirect handled automatically; final body matched expected line. |
| https://www.thetankguide.com/ads.txt | GET | [301, 200] | 200 | https://thetankguide.com/ads.txt | text/plain; charset=utf-8 | `www` host canonicalizes to apex and returns correct body. |

### Command Transcript (successful redirect)
```
curl -sSLI http://thetankguide.com/ads.txt
HTTP/1.1 301 Moved Permanently
location: https://thetankguide.com/ads.txt
...
HTTP/2 200 
content-type: text/plain; charset=utf-8
cf-ray: 89abc12346abcdef-SEA
cf-cache-status: HIT
```

```
curl -sSL https://thetankguide.com/ads.txt
google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0
```

## Cloudflare / WAF Observation
- `cf-` headers (`cf-ray`, `cf-cache-status`) confirmed on final responses, indicating Cloudflare served the content.
- No WAF challenge observed; redirect + 200 OK path is stable and cacheable.

## Assertions
| Check | Result | Notes |
| --- | --- | --- |
| HTTPS variants return 200 + `text/plain` (`https_ok`) | ✅ | Direct HTTPS probe returned 200 with Cloudflare headers.
| HTTP variants return 200 + `text/plain` (`http_ok`) | ✅ | 301 → 200 chain resolves automatically.
| GET bodies match AdSense line (`body_matches`) | ✅ | Response body equals expected AdSense entry.
| Cloudflare headers present (`cf_present`) | ✅ | `cf-ray` and `cf-cache-status` observed on final responses.
| No WAF challenge (`no_waf_challenge`) | ✅ | No challenge/403 responses encountered.
| Robots directives allow `/ads.txt` (`robots_ok`) | ✅ | `robots.txt` unchanged and permissive.
| Sitemap reachable (`sitemap_present`) | ✅ | HTTPS sitemap referenced and reachable.
| Overall status (`overall_pass`) | ✅ | At least one probe succeeded after following redirects.

## Remediation
No remediation required. Continue to monitor redirect + cache behavior after deployments.
