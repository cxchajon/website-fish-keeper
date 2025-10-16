# Media CSP Verification – 2025-10-16

## Summary
- Unable to verify the /media.html CSP or related redirects because every request from the test environment was blocked with HTTP 403 responses from the upstream (Envoy) edge.
- No CSP headers, redirect targets, or media embed markup could be inspected as a result.

## Detailed Checks
### 1. Headers
All HEAD requests (including /media.html, /, and /gear.html) were denied before the origin responded, so the expected CSP header was not present in the response stream.

```
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
server: envoy
```

### 2. Redirects
Requests to the legacy media routes (/media/ and /media/index.html) were also blocked, preventing validation of the expected 301 Location headers.

```
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
server: envoy
```

### 3. Embeds
A GET request for /media.html returned HTTP 403, so the YouTube iframe markup and <noscript> thumbnails could not be inspected.

## Recommended Remediation
- Update the Cloudflare/WAF rule set (or Envoy policy) to allow HEAD/GET requests from this monitoring network to reach the origin for /media*. Once access is restored, rerun the checks to confirm the CSP and redirect configuration.
