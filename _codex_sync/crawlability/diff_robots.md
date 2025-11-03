## robots.txt changes

```diff
@@
 User-agent: *
 Allow: /
+Disallow: /prototype/
+Disallow: /prototype-home.html
 
 Sitemap: https://thetankguide.com/sitemap.xml
```

Added explicit blocks for prototype paths while keeping the primary site crawlable.
