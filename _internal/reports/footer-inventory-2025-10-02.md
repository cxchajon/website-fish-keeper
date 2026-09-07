# Footer Inventory — October 2, 2025

## Files discovered
- `/footer.html`
- `/footer.v1.2.2.html`
- `/footer.v1.2.3.html`
- `/store.html` (embedded copy at the bottom of the page)

## Loader patterns (pre-unification)
- `index.html`, `about.html`, `feature-your-tank.html`, `contact-feedback.html`, `privacy-legal.html`, `terms.html`, `media.html`, `params.html`, `stocking-advisor.html`, `copyright-dmca.html`: each included `<div id="site-footer"></div>` followed by an inline script fetching `footer.v1.2.3.html?v=1.2.3` with a **relative** URL (no leading slash).
- `gear/index.html`: same structure but already fetched `'/footer.v1.2.3.html?v=1.2.3'` with a leading slash.
- `store.html`: contained an inline footer block (no loader) duplicating the v1.2.3 markup.

All loaders used an async IIFE, called `host.outerHTML = html`, and fetched with `{ cache: 'no-cache' }`.

## Markup comparison (as found)

### `/footer.html`
```html
<!-- FOOTER v1.2.3 — socials restored ABOVE legal links; quick links now include Store -->
<footer class="site-footer">
  <!-- SOCIALS (icon row) -->
  <div class="social-strip" role="navigation" aria-label="Social links">
    <a href="https://www.instagram.com/FishKeepingLifeCo" target="_blank" rel="noopener noreferrer" aria-label="The Tank Guide on Instagram">
      <i class="fab fa-instagram" aria-hidden="true"></i>
    </a>
    <a href="https://www.tiktok.com/@FishKeepingLifeCo" target="_blank" rel="noopener noreferrer" aria-label="The Tank Guide on TikTok">
      <i class="fab fa-tiktok" aria-hidden="true"></i>
    </a>
    <a href="https://www.facebook.com/fishkeepinglifeco" target="_blank" rel="noopener noreferrer" aria-label="The Tank Guide on Facebook">
      <i class="fab fa-facebook" aria-hidden="true"></i>
    </a>
    <a href="https://x.com/fishkeepinglife?s=21" target="_blank" rel="noopener noreferrer" aria-label="The Tank Guide on X (Twitter)">
      <i class="fab fa-x-twitter" aria-hidden="true"></i>
    </a>
    <a href="https://www.youtube.com/@fishkeepinglifeco" target="_blank" rel="noopener noreferrer" aria-label="The Tank Guide on YouTube">
      <i class="fab fa-youtube" aria-hidden="true"></i>
    </a>
    <a href="https://amzn.to/3IRKvK0" target="_blank" rel="sponsored noopener noreferrer" aria-label="The Tank Guide on Amazon">
      <i class="fab fa-amazon" aria-hidden="true"></i>
    </a>
  </div>

  <!-- LEGAL LINKS -->
  <nav class="footer-links" aria-label="Footer links">
    <a href="/privacy-legal.html">Privacy &amp; Legal</a>
    <span class="dot">·</span>
    <a href="/terms.html">Terms of Use</a>
    <span class="dot">·</span>
    <a href="#cookie-settings" onclick="window.cookieConsent && window.cookieConsent.open(); return false;">Cookie Settings</a>
    <span class="dot">·</span>
    <a href="/store.html">Store</a>
    <span class="dot">·</span>
    <a href="/copyright-dmca.html">Copyright &amp; DMCA</a>
  </nav>

  <!-- COPYRIGHT + AMAZON CTA -->
  <p class="footer-note">
    © 2025 The Tank Guide • FishKeepingLifeCo
    <br>
    As an Amazon Associate, we earn from qualifying purchases.
    <br>
    <a class="amazon-cta" href="https://amzn.to/3IRKvK0" target="_blank" rel="sponsored noopener noreferrer">
      Shop our books on Amazon »
    </a>
  </p>
</footer>
```

### `/footer.v1.2.2.html`
(identical to `/footer.html`; no Store link in comment header)

### `/footer.v1.2.3.html`
(identical to `/footer.html`; added comment noting Store link)

### `/store.html` embedded footer
Same markup as `/footer.v1.2.3.html`, inlined beneath the Store content.

## Notable differences pre-unification
- All social links already used Font Awesome icons and the Instagram → Amazon order.
- Cookie Settings link used an `onclick` handler instead of a dedicated page.
- Store page duplicated the footer HTML instead of loading the shared partial.
- Most pages fetched the footer with a relative path (risking 404s from nested directories); only `gear/index.html` used an absolute path.
- CSS for `.site-footer` lived centrally in `css/style.css`, so no inline `<style>` blocks were embedded in the footer HTML files.
