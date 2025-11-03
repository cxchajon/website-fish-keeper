Network proxy blocked automated sitemap ping attempts (HTTP 403). Manually trigger re-crawls by running:

```
curl -I "https://www.google.com/ping?sitemap=https://thetankguide.com/sitemap.xml"
curl -I "https://www.bing.com/ping?sitemap=https://thetankguide.com/sitemap.xml"
```

Alternatively submit the refreshed sitemap URL inside Google Search Console (Indexing → Sitemaps) and Bing Webmaster Tools (Sitemaps section).
