# Filter Data Sources

## data/filters.json
- **Type:** JSON array of product records (`id`, `name`, `brand`, `type`, `rated_gph`).
- **Count:** 52 entries (shared with the production site-wide catalog).
- **Schema sample:** `{"id","name","brand","type","rated_gph"}`.【F:data/filters.json†L1-L16】
- **Usage:** Live stocking calculator fetches this catalog at runtime via `FILTER_CATALOG_PATH` in `js/stocking.js`.【F:js/stocking.js†L171-L175】【F:js/stocking.js†L653-L656】
- **Notes:** Values lack size metadata (`min/max gallons`), and the list includes duplicate marketing variants (`*-1` suffixes) plus non-standard brand casing. These gaps forced downstream heuristics to guess tank ranges.

## prototype/assets/data/filters.json
- **Type:** Prototype-local copy of the same JSON catalog (52 entries).
- **Schema sample:** identical structure to `data/filters.json` (shown above).【F:prototype/assets/data/filters.json†L1-L16】
- **Usage:** Previously fetched by `prototype/assets/js/products/filters.js` (now replaced) to populate the prototype dropdown.

## audit_out/filters.json
- **Type:** Historical audit export (53 entries) combining multiple upstream CSVs with metadata like `typeDeclared`, `typeInferred`, `sourcePaths`, and `notes`.
- **Schema sample:** Each record mixes source lineage with the raw `gphRated` figure, but 38/53 rows carry `gphRated: 0`, so they were filtered out by the prototype loader.【F:audit_out/filters.json†L1-L20】
- **Notes:** Helpful for provenance but unsuitable for the dropdown because flow rates are often missing and types conflict (`typeDeclared` ≠ `typeInferred`).

## audit_out/filters.csv
- **Type:** CSV mirror of the audit export with the same 53 IDs.
- **Schema sample:** `id,name,gphRated,typeDeclared,typeInferred,brand,sourcePaths` — retains only basic columns.【F:audit_out/filters.csv†L1-L5】
- **Notes:** Provides a simple spreadsheet view for reconciliation but no additional sizing hints.

## data/gear_filters.csv
- **Type:** Editorial gear list (12 rows) describing filter **media** products, not full filter units.
- **Schema sample:** `category,subgroup,title,notes,amazon_url,...` highlighting accessories like Purigen resin.【F:data/gear_filters.csv†L1-L6】
- **Usage:** Content/gear hub; unsuitable for product gating because no GPH or tank metadata exists.

## data/gear_filters_ranges.csv
- **Type:** Tank-size matrix (18 rows) pairing tank ranges with recommended SKUs and affiliate links.
- **Schema sample:** Columns such as `Tank_Size`, `Product_Name`, `Option_Label`, `Range_ID` encode human-readable ranges (e.g., "5–10 Gallons").【F:data/gear_filters_ranges.csv†L1-L6】
- **Notes:** Contains the only explicit gallon ranges, but entries mix Amazon marketing titles, making automated joins fragile without custom text cleaning.

## Prototype loader (current state)
- **File:** `prototype/assets/js/products/catalog-loader.js` — new normalized loader that ingests `filters.catalog.json`, sanitizes numeric fields, caches results, and exposes `loadFilterCatalog`, `filterProductsByTankSize`, and `sortByTypeBrandGph` with graceful error handling.【F:prototype/assets/js/products/catalog-loader.js†L1-L101】
- **Dataset:** `prototype/assets/data/filters.catalog.json` — deduped 32-row catalog with normalized `brand`, `model`, `type`, `gphRated`, `minGallons`, and `maxGallons` fields, derived from `data/filters.json` plus heuristic range inference.【F:prototype/assets/data/filters.catalog.json†L1-L20】
- **Heuristic:** Tank ranges fall back to GPH tiers (≤120 → 0–20g, 120–220 → 20–40g, 220–400 → 40–75g, >400 → 75g+) and are embedded in the data so consumers no longer recalculate them.【F:prototype/assets/js/products/catalog-loader.js†L101-L103】

### Root-cause summary
- The prototype previously fetched `filters.json`, then `normalizeCatalogItem` discarded records lacking `gphRated` (most entries in the audit export report `0`), leaving only a sparse list. With no `min/max` gallons in the source, size-gating fell back to heuristics and frequently triggered the "All filters (no size match)" fallback state.
- Because the fallback list reused the same noisy marketing titles (`AC30 Power Filter, 10–30 US Gal / 38–114 L – Fluval USA …`), dropdown labels became unwieldy and duplicates obscured SPONGE vs. HOB types.
- Consolidating the catalog into `filters.catalog.json` (deduped by brand/model/GPH, with normalized type casing) plus the new loader restores predictable matches for tanks at 10g, 20g, 29g, 40B, and 55g — the dropdown now has real data to render instead of an empty "No matching products" state.
