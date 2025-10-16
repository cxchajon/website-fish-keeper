# ads.txt Delivery Readiness

## Probe Summary

| URL | Final Status | Curl Exit | Notes |
| --- | ------------ | --------- | ----- |
| https://thetankguide.com/ads.txt | 403 | 56 | Blocked by upstream proxy during local verification. |
| http://thetankguide.com/ads.txt | 403 | 0 | HTTP responded with `Forbidden`; expect 301→200 once deployed. |
| https://www.thetankguide.com/ads.txt | 403 | 56 | Same proxy block as apex. |

_Environment note:_ The container's network returned 403 responses for all variants, so the checks failed locally. Production should return `200` once the Cloudflare bypass and caching purge are applied.

## Headers Observed (last response)

```
Content-Type: text/plain
X-Content-Type-Options: (none)
Cache-Control: (none)
CF-* headers: (not visible in proxy response)
```

## Body Preview

- https://thetankguide.com/ads.txt → *(non-Google)* _empty body due to proxy failure_
- http://thetankguide.com/ads.txt → *(non-Google)* `Forbidden`
- https://www.thetankguide.com/ads.txt → *(non-Google)* _empty body due to proxy failure_

## Cloudflare / CDN Steps

- ✅ `scripts/cloudflare-ads-txt-bypass.sh` generates/updates the Cloudflare skip rule and purges `/ads.txt`.
- ✅ `scripts/purge-ads-txt.sh` issues a single-file cache purge when Cloudflare credentials are supplied (prints manual instructions otherwise).
- Manual action: run `scripts/cloudflare-ads-txt-bypass.sh` with valid `CF_API_TOKEN` and `CF_ZONE_ID` to finalize the WAF exception and purge the cache.

## How to verify in AdSense

After deploying and purging caches, open the AdSense console and use **Sites → Fix ads.txt** (or **Check ads.txt**) to trigger a re-scan. Google may take up to 24 hours to acknowledge the updated file.
