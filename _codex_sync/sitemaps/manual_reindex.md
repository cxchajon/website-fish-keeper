# Manual recrawl actions

Network egress from the automation environment is blocked (HTTP 403 on sitemap ping endpoints).

To complete resubmission manually:

1. Re-run sitemap pings from a network with access:
   ```bash
   curl -i "https://www.google.com/ping?sitemap=https://thetankguide.com/sitemap.xml"
   curl -i "https://www.bing.com/ping?sitemap=https://thetankguide.com/sitemap.xml"
   ```
2. In Google Search Console, open the TheTankGuide.com property and use **Indexing → Sitemaps** to resubmit `https://thetankguide.com/sitemap.xml`. Optionally use **URL Inspection** on the priority URLs listed in `reindex_candidates.txt`.
3. In Bing Webmaster Tools, navigate to **URL Submission → Sitemaps** and submit the sitemap URL again.
