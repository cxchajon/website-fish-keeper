# Footer audit — 2025-10-18

## Inventory before remediation

| Path | has_placeholder | has_loader | embeds_inline_footer | fetches_url | notes |
| --- | --- | --- | --- | --- | --- |
| 404.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| about.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| archive/footers/footer-legal.html | N | N | Y | — | Archive resource; Missing placeholder; Missing loader script; Inline footer markup present |
| blogs/bba/backups/gear-section-preupdate.html | N | N | N | — | Backup fragment; Missing placeholder; Missing loader script |
| blogs/blackbeard/index.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| blogs/cycle-check-3-readings/index.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| blogs/index.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| blogs/purigen/index.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| contact-feedback.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| cookie-settings.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| copyright-dmca.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| feature-your-tank.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| footer.html | N | N | Y | — | Canonical footer partial; Missing placeholder; Missing loader script |
| gear.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| gear/index.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| includes/ga4.html | N | N | N | — | Server include; Missing placeholder; Missing loader script |
| includes/head.html | N | N | N | — | Server include; Missing placeholder; Missing loader script |
| index.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| media.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| nav.html | N | N | N | — | Navigation partial; Missing placeholder; Missing loader script |
| pages/university.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| params.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| privacy-legal.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| stocking-advisor.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| store.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| templates/blog-footer-gear.html | N | N | N | — | Template fragment; Missing placeholder; Missing loader script |
| terms.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| trust-security.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |
| university/index.html | Y | Y | N | — | Loader src: /js/footer-loader.js; Uses loader default |

## Inventory after remediation

| Path | has_placeholder | has_loader | embeds_inline_footer | fetches_url | notes |
| --- | --- | --- | --- | --- | --- |
| 404.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| about.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| archive/footers/footer-legal.html | — | — | — | — | Removed |
| blogs/bba/backups/gear-section-preupdate.html | N | N | N | — | Backup fragment; Missing placeholder; Missing loader script |
| blogs/blackbeard/index.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| blogs/cycle-check-3-readings/index.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| blogs/index.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| blogs/purigen/index.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| contact-feedback.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| cookie-settings.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| copyright-dmca.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| feature-your-tank.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| footer.html | N | N | Y | — | Canonical footer partial; Missing placeholder; Missing loader script |
| gear.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| gear/index.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| includes/ga4.html | N | N | N | — | Server include; Missing placeholder; Missing loader script |
| includes/head.html | N | N | N | — | Server include; Missing placeholder; Missing loader script |
| index.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| media.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| nav.html | N | N | N | — | Navigation partial; Missing placeholder; Missing loader script |
| pages/university.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| params.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| privacy-legal.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| stocking-advisor.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| store.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| templates/blog-footer-gear.html | — | — | — | — | Removed |
| terms.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| trust-security.html | Y | Y | N | /footer.html?v=1.5.2 |  |
| university/index.html | Y | Y | N | /footer.html?v=1.5.2 |  |

## Files updated to normalize placeholder/loader

`404.html`, `about.html`, `blogs/blackbeard/index.html`, `blogs/cycle-check-3-readings/index.html`, `blogs/index.html`, `blogs/purigen/index.html`, `contact-feedback.html`, `cookie-settings.html`, `copyright-dmca.html`, `feature-your-tank.html`, `gear.html`, `gear/index.html`, `index.html`, `media.html`, `pages/university.html`, `params.html`, `privacy-legal.html`, `stocking-advisor.html`, `store.html`, `terms.html`, `trust-security.html`, `university/index.html`

Legacy fragments removed: `archive/footers/footer-legal.html`, `templates/blog-footer-gear.html`.

## Footer lock hashes (`.footer.lock.json`)

- `/footer.html`: `e229a7b2429e0ae8653b0be6f8fea8191e36523358b7298f69c77d62cdb9b364`
- `/assets/sprite.socials.svg`: `a1a256949d3580e13df6ac47dbe0277fffe8d91cc375d0f4568c284389a85c74`
- `/js/footer-loader.js`: `e6455aa2a9e82eeefc385ed8494ffac622147c73c640ea313333f4a19b7eacf3`
- `/css/site.css`: `99af51da42d655a37530e142e009deef9fb3bfd83e1d65e20e39e19bba51ae8e`

## Guard rails added

- Git hooks: `.githooks/pre-commit`, `.githooks/pre-push`
- CI workflow: `.github/workflows/footer-lock.yml`
- Lint command: `node scripts/footer-lock/lint.mjs`

