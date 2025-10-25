```
| Control / Viewport | 390x844 | 375x667 | 768x1024 | 1440x900 | 1920x1080 |
|--------------------|---------|---------|----------|----------|-----------|
| Hero stocking tip  | PASS    | PASS    | PASS     | PASS     | PASS      |
| Tank size          | PASS    | PASS    | PASS     | PASS     | PASS      |
| Planted toggle     | PASS    | PASS    | PASS     | PASS     | PASS      |
| Filter product     | PASS    | PASS    | PASS     | PASS     | PASS      |
| Rated flow         | PASS    | PASS    | PASS     | PASS     | PASS      |
| Turnover guidance  | PASS    | PASS    | PASS     | PASS     | PASS      |
| Stocking checklist | PASS    | PASS    | PASS     | PASS     | PASS      |
| Environment info   | PASS    | PASS    | PASS     | PASS     | PASS      |

Notes:
- Popovers now receive `.is-open`, revealing them visually and enabling pointer interactions.
- Duplicate close icons are hidden and inert when present in the prototype markup.
- JS ensures outside click, Esc, and re-toggle all close the active popover.
- Console and network logs unavailable in container; no new errors expected from static inspection.
```
