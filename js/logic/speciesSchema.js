export const REQUIRED_FIELDS = [
  "id","common_name","scientific_name","category","adult_size_in","min_tank_length_in",
  "temperature","ph","gH","kH","salinity","flow","blackwater","aggression","tags"
];

import { BEHAVIOR_TAG_VALUES } from "./behaviorTags.js";
import { validateBioloadInputs } from "../stocking-advisor/logic/bioload-model.js";

// Tags used by the legacy engine rules (js/fish-data.js + LEGACY_BASE in the v2 adapter).
export const LEGACY_TAGS = Object.freeze([
  "betta","betta_male","livebearer","labyrinth","algae_specialist","nano",
  "shoaler","schooling_shoaler","bottom_dweller","fast_swimmer","nocturnal","territorial",
  "fin_nipper","fin_sensitive","invert_safe","cichlid",
  "long_fins","slow_long_fins","aggressive","semi_aggressive"
]);

// Tags used by data/stocking-advisor/species.v2.json (the dataset behind the species dropdown).
// Every record the advisor offers must validate, so any new tag added to the JSON must be listed
// here too — tests/unit/species-integrity.test.mjs fails if one is missing.
export const V2_TAGS = Object.freeze([
  "active_swimmer","aggressive","algae_eater","apisto","beginner","betta_shape_trigger",
  "bottom_dweller","cave_spawner","centerpiece","centerpiece_snail","cichlid","cold_water",
  "colorful","community","filter_feeder","fin_nipper","hardy","high_flow","labyrinth",
  "livebearer","longfin_target","low_cost","low_flow","nano","nocturnal","oddball","peaceful",
  "predatory","prolific","requires_cover","scavenger","schooling","semi_nipper","sensitive",
  "shrimp_risk","shrimp_safe","shy","snail_control","snail_risk","snail_safe","specialized",
  "territorial","utility","fish_risk"
]);

const ALLOWED_TAGS = new Set([...LEGACY_TAGS, ...V2_TAGS]);

const ALLOWED_BEHAVIOR_TAGS = new Set(BEHAVIOR_TAG_VALUES);

const SUPPORTED_SALINITY = new Set(["fresh", "brackish-low", "brackish-high", "dual"]);

export function validateSpeciesRecord(s) {
  try {
    for (const k of REQUIRED_FIELDS) if (!(k in s)) return `missing ${k}`;
    if (!/^[a-z0-9_]+$/.test(s.id)) return "invalid id";
    if (!["fish","shrimp","snail"].includes(s.category)) return "bad category";
    const num = v => typeof v === "number" && isFinite(v);
    const pick = (r, keys) => {
      if (!r) return NaN;
      for (const key of keys) {
        if (num(r[key])) return r[key];
      }
      return NaN;
    };
    const rng = r => {
      if (!r) return false;
      const min = pick(r, ["min","min_f","min_dGH","min_dKH"]);
      const max = pick(r, ["max","max_f","max_dGH","max_dKH"]);
      return num(min) && num(max) && min < max;
    };
    if (!rng(s.temperature)) return "bad temperature";
    if (!rng(s.ph))          return "bad ph";
    if (!rng(s.gH))          return "bad gH";
    if (!rng(s.kH))          return "bad kH";
    if (!SUPPORTED_SALINITY.has(s.salinity)) return "bad salinity";
    if (!["low","moderate","high"].includes(s.flow)) return "bad flow";
    // null = not assessed (no source makes a tannin claim); the engine applies no blackwater rule.
    if (s.blackwater !== null && !["requires","prefers","neutral"].includes(s.blackwater)) return "bad blackwater";
    if (typeof s.scientific_name !== "string" || !s.scientific_name.trim()) return "missing scientific_name";
    if (!(num(s.adult_size_in) && s.adult_size_in > 0)) return "bad adult_size_in";
    // A tank length may only be absent when the record says it does not apply (crawling snails).
    if (s.min_tank_length_in === null) {
      if (s.tank_length_not_applicable !== true) return "missing min_tank_length_in";
    } else if (!(num(s.min_tank_length_in) && s.min_tank_length_in > 0)) {
      return "bad min_tank_length_in";
    }
    if (s.min_tank_liters != null && !(num(s.min_tank_liters) && s.min_tank_liters > 0)) return "bad min_tank_liters";
    if (!num(s.aggression)) return "bad numbers";
    // Advisor records carry bioload_profile and a model-derived bioloadGE; a record whose model inputs
    // are incomplete is rejected here (and flagged to the user), never counted as zero load.
    if (s.bioload_profile !== undefined) {
      const inputs = validateBioloadInputs({ adultSizeIn: s.adult_size_in, category: s.category, profile: s.bioload_profile });
      if (inputs !== true) return inputs;
    }
    if (!(num(s.bioloadGE) && s.bioloadGE > 0)) return "bad bioloadGE";
    if (!Array.isArray(s.tags)) return "bad tags";
    for (const t of s.tags) {
      if (!ALLOWED_TAGS.has(t)) return `bad tag:${t}`;
    }
    if (s.behavior != null) {
      if (!Array.isArray(s.behavior)) return "bad behavior";
      for (const tag of s.behavior) {
        if (!ALLOWED_BEHAVIOR_TAGS.has(tag)) return `bad behavior tag:${tag}`;
      }
    }
    if (s.min_group != null) {
      const mg = Number(s.min_group);
      if (!Number.isFinite(mg) || mg < 0) return "bad min_group";
    }
    return true;
  } catch (e) { return e.message || "unknown"; }
}
