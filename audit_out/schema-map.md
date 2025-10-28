# Filter Schema Map

| Field | `data/filters.json` | `audit_out/filters.json` | `filters.catalog.json` | Notes |
| --- | --- | --- | --- | --- |
| `id` | Present (slug, sometimes suffixed `-1`).【F:data/filters.json†L1-L16】 | Present (same IDs, may repeat for audit artifacts).【F:audit_out/filters.json†L1-L20】 | Present, deduped and lower-noise.【F:prototype/assets/data/filters.catalog.json†L1-L20】 | Used as primary key in loaders.
| `brand` | Present but inconsistent casing (e.g., `AQUANEAT`, `Fluval`).【F:data/filters.json†L1-L16】 | Present; audit mix keeps source casing.【F:audit_out/filters.json†L1-L20】 | Normalized to title case where possible (e.g., `Aquaneat`).【F:prototype/assets/data/filters.catalog.json†L1-L20】 | Canonicalized for dropdown labels.
| `name` / `model` | `name` contains long marketing titles with duplicate variants.【F:data/filters.json†L1-L16】 | `name` mirrors marketing copy; `model` absent.【F:audit_out/filters.json†L1-L20】 | New `model` shortens titles (e.g., `Dual Sponge (up to 20G)`).【F:prototype/assets/data/filters.catalog.json†L1-L20】 | Makes dropdown label concise while preserving size hints.
| `type` | Present but loosely categorized (HOB, CANISTER, OTHER).【F:data/filters.json†L1-L16】 | Two fields: `typeDeclared`, `typeInferred` (often disagree).【F:audit_out/filters.json†L1-L20】 | Canonicalized (`SPONGE`, `HOB`, `CANISTER`, `UGF`).【F:prototype/assets/data/filters.catalog.json†L1-L20】 | Loader uses normalized type ordering.【F:prototype/assets/js/products/catalog-loader.js†L1-L54】
| `rated_gph` / `gphRated` | `rated_gph` numeric, but no zero-check or validation.【F:data/filters.json†L1-L16】 | `gphRated` present but frequently `0` (38 rows).【F:audit_out/filters.json†L1-L20】 | `gphRated` guaranteed positive integers after sanitization.【F:prototype/assets/js/products/catalog-loader.js†L16-L47】 | Feed for turnover math.
| Size bounds | Not provided. | Not provided. | `minGallons` / `maxGallons` populated via text parsing + GPH heuristics.【F:prototype/assets/data/filters.catalog.json†L1-L20】【F:prototype/assets/js/products/catalog-loader.js†L101-L103】 | Eliminates empty matches for small/large tanks.
| Source metadata | None. | `sources`, `sourcePaths`, `notes` arrays.【F:audit_out/filters.json†L1-L20】 | Omitted to keep payload lean. | Audit artifacts remain documented separately.

