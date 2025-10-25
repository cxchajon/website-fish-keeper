# Preflight Discovery

## 0.1 Species library locations
- `js/fish-data.js` – ES module exporting `FISH_DB` array of species records; imports schema validator. Format: ESM.
- `js/logic/speciesSchema.js` – schema validator and field definitions for species records; ESM.
- Supporting enums: `js/logic/behaviorTags.js` (ESM list of behavior tags).

## 0.2 Key schema fields (sample of 10 species)
1. `betta_male`: temperature `{min_f:75,max_f:82}` (°F), pH `{min:6.0,max:8.0}`, gH `{min_dGH:5,max_dGH:19}`, kH `{min_dKH:2,max_dKH:10}`, aggression `70`, tags include `long_fins`, `aggressive`; `invert_safe:false`; `bioloadGE:2.5`; `mouth_size_in:0.3`.
2. `betta_female`: similar temp/pH, gH/kH ranges, aggression `40`, `invert_safe:false`, `bioloadGE:2.0`.
3. `dgourami`: temp `{min_f:72,max_f:82}`, pH `{min:6.0,max:7.5}`, gH `{min_dGH:4,max_dGH:15}`, tags `labyrinth`, `fin_sensitive`, `invert_safe:false`, `bioloadGE:2.0`.
4. `pgourami`: temp `{min_f:77,max_f:82}`, pH `{min:5.5,max:7.5}`, gH `{min_dGH:5,max_dGH:19}`, group `{type:"harem",min:3,ratio:{m:1,f:2}}`, `invert_safe:false`, `bioloadGE:4.0`.
5. `cardinal`: temp `{min_f:74,max_f:80}`, pH `{min:4.5,max:7.5}`, gH `{min_dGH:1,max_dGH:12}`, tags `shoaler`, `fin_sensitive`, `invert_safe:false`, `ph_sensitive:true`, `bioloadGE:0.6`.
6. `neon`: temp `{min_f:70,max_f:77}`, pH `{min:4.5,max:7.5}`, gH `{min_dGH:1,max_dGH:12}`, tags `shoaler`, `nano`, `invert_safe:false`, `bioloadGE:0.6`.
7. `rummynose`: temp `{min_f:75,max_f:81}`, pH `{min:5.5,max:7.0}`, gH `{min_dGH:2,max_dGH:15}`, tags `shoaler`, `fast_swimmer`, `invert_safe:false`, `bioloadGE:0.8`.
8. `chili`: temp `{min_f:72,max_f:80}`, pH `{min:5.0,max:7.0}`, gH `{min_dGH:0,max_dGH:8}`, tags `shoaler`, `nano`, `invert_safe:true`, `bioloadGE:0.3`.
9. `tiger_barb`: temp `{min_f:72,max_f:82}`, aggression `55`, tags `fin_nipper`, `semi_aggressive`, `bioloadGE:1.6`, `min_group:6`.
10. `cory_panda`: temp `{min_f:69,max_f:77}`, tags `shoaler`, `bottom_dweller`, `invert_safe:true`, `bioloadGE:1.0`, group `{type:"shoal",min:5}`.

## 0.3 Units and conversions
- Temperature stored in Fahrenheit via `min_f`/`max_f`. No °C fields present. Tests should use °F directly.
- gH/kH provided as `{min_dGH,max_dGH}` and `{min_dKH,max_dKH}` respectively. Already in degrees (°dGH / °dKH). No ppm conversions needed.

## 0.4 Special compatibility flags
- `salinity`: values `fresh`, `dual`, and (per schema) `brackish-low/high` possible; dataset sample includes `fresh` and `dual`.
- `invert_safe` boolean; predators flagged via tags `predator_shrimp`, `predator_snail`.
- `aggression`: numeric 0–100 scale; tags also include `aggressive`, `semi_aggressive`.
- Behavior tags from `behavior` array (e.g., `FIN_NIPPER`, `SLOW_SWIMMER`, `SHOALING`).
- `group` objects define shoaling/harem requirements; some species also have `min_group` numeric fallback.
- Tags such as `fin_nipper`, `long_fins`, `slow_long_fins` influence compatibility.
- `blackwater`/`flow` provide environmental context (requires/prefers/neutral).

