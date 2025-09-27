export const REQUIRED_FIELDS = [
  "id","common_name","scientific_name","category","adult_size_in","min_tank_length_in",
  "temperature","ph","gH","kH","salinity","flow","blackwater","aggression","tags"
];

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
    if (!["fresh","brackish-low","brackish-high","dual","marine"].includes(s.salinity)) return "bad salinity";
    if (!["low","moderate","high"].includes(s.flow)) return "bad flow";
    if (!["requires","prefers","neutral"].includes(s.blackwater)) return "bad blackwater";
    if (!(num(s.adult_size_in) && num(s.min_tank_length_in) && num(s.aggression))) return "bad numbers";
    if (!Array.isArray(s.tags)) return "bad tags";
    return true;
  } catch (e) { return e.message || "unknown"; }
}
