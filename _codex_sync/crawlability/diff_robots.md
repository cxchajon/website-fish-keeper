## robots.txt changes

```diff
@@
 User-agent: *
 Allow: /
+Disallow: /prototype/

 Sitemap: https://thetankguide.com/sitemap.xml
```

Added an explicit block for the /prototype/ directory while keeping the primary site crawlable.
