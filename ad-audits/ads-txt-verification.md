# Ads.txt Verification Report

## Pre-flight
- `ads.txt` (repo root) currently contains a single line: `google.com, pub-9905718149811880, DIRECT, f08c47fec0942fa0`.
- Netlify-style `_headers` file defines `/ads.txt` with `Content-Type: text/plain; charset=utf-8` and `Cache-Control: max-age=300`; no directives that would block plain text delivery.
- `robots.txt` allows all crawlers and references the HTTPS sitemap at `https://thetankguide.com/sitemap.xml`.
- Sitemap files present in the repo: `/sitemap.xml`.

## Live Probes
The environment returned HTTP 403 responses (served by an upstream Envoy proxy) for all probes. No Cloudflare headers were observed, implying the requests did not reach Cloudflare.

| URL | Method | Status | Content-Type | Notes |
| --- | --- | --- | --- | --- |
| https://thetankguide.com/ads.txt | HEAD | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).
| https://thetankguide.com/ads.txt | GET | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).
| http://thetankguide.com/ads.txt | HEAD | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).
| http://thetankguide.com/ads.txt | GET | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).
| https://www.thetankguide.com/ads.txt | HEAD | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).
| https://www.thetankguide.com/ads.txt | GET | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).
| http://www.thetankguide.com/ads.txt | HEAD | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).
| http://www.thetankguide.com/ads.txt | GET | 403 | text/plain | Blocked by outbound proxy before Cloudflare (Envoy 403).

### Command Transcripts
```
curl -I https://thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:15:56 GMT
server: envoy
connection: close
curl: (56) CONNECT tunnel failed, response 403
```

```
curl -i https://thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:16:06 GMT
server: envoy
connection: close
curl: (56) CONNECT tunnel failed, response 403
```

```
curl -I http://thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:16:03 GMT
server: envoy
```

```
curl -i http://thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:16:08 GMT
server: envoy

Forbidden
```

```
curl -I https://www.thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:16:11 GMT
server: envoy
connection: close
curl: (56) CONNECT tunnel failed, response 403
```

```
curl -i https://www.thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:16:15 GMT
server: envoy
connection: close
curl: (56) CONNECT tunnel failed, response 403
```

```
curl -I http://www.thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:16:13 GMT
server: envoy
```

```
curl -i http://www.thetankguide.com/ads.txt
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Thu, 16 Oct 2025 14:16:16 GMT
server: envoy

Forbidden
```

## Cloudflare / WAF Observation
- No `cf-` headers were present in the probe responses, so the requests never reached Cloudflare from this environment. A Cloudflare WAF skip rule for `/ads.txt` could not be verified programmatically.
- Operator verification steps:
  1. Log into Cloudflare Dashboard.
  2. Navigate to **Security → WAF → Custom rules**.
  3. Confirm a rule with expression `(http.request.uri.path eq "/ads.txt")` exists with action **Skip** (Managed Rules + Super Bot Fight Mode).
  4. Capture a screenshot of the rule (placeholder: _pending operator capture_).

## Assertions
| Check | Result | Notes |
| --- | --- | --- |
| HTTPS variants return 200 + `text/plain` (`https_ok`) | ❌ | Outbound proxy returned 403 before Cloudflare.
| HTTP variants return 200 + `text/plain` (`http_ok`) | ❌ | Outbound proxy returned 403 before Cloudflare.
| GET bodies match AdSense line (`body_matches`) | ❌ | No successful GET responses observed.
| Cloudflare headers present (`cf_present`) | ❌ | Responses served by Envoy proxy, no Cloudflare headers.
| No WAF challenge (`no_waf_challenge`) | ❌ | 403 Forbidden responses encountered.
| Robots directives allow `/ads.txt` (`robots_ok`) | ✅ | `robots.txt` allows all and references HTTPS sitemap.
| Sitemap reachable (`sitemap_present`) | ❌ | Reachability not confirmed due to blocked outbound HTTP requests.
| Overall status (`overall_pass`) | ❌ | Blocked probes prevented verification.

## Remediation
- Re-run the eight probe commands from a network without the outbound Envoy proxy (e.g., local machine, Cloudflare Diagnostic Center) to validate HTTP 200 responses and headers.
- In Cloudflare Dashboard, confirm the `/ads.txt` Skip rule is active under **Security → WAF → Custom rules** and adjust if missing.
- After confirming rule and cache, purge `/ads.txt` if necessary (**Caching → Custom Purge → URL → https://thetankguide.com/ads.txt**), then re-run probes.
