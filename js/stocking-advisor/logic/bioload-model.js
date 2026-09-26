// Stocking Advisor bioload model — one methodology for every selectable species.
// Methodology, constants and their justification: data/stocking-advisor/BIOLOAD_MODEL.md
//
//   bioloadGE = SCALE × adult_size_in² × BUILD[body_build] × CATEGORY[category] × WASTE[waste_class]
//
// It is an advisory estimate of relative waste-processing burden, not a measured carrying capacity.
// The inputs are the species record's adult size and category plus `bioload_profile`
// ({ body_build, waste_class }) in species.v2.json. Nothing here is species-specific.

// GE (gallon-equivalents) per square inch of adult length for a standard-build fish. The GE scale is
// the one the capacity side already uses (percent = GE ÷ effective gallons); 0.2 keeps the overall
// level of the 20 original hand-set values (their geometric mean moves by under 5%).
export const BIOLOAD_SCALE = 0.2;

// Load grows with length² (mass^(2/3), with mass ∝ length³ × build). Kept as a named constant so the
// tests and documentation refer to one value.
export const LENGTH_EXPONENT = 2;

// Relative body mass for a given length, raised to the same 2/3 power
// (elongate ≈ 0.35×, slender ≈ 0.7×, deep ≈ 1.5×, disc ≈ 2× the mass of a standard-build fish).
// Fish only; invertebrates use CATEGORY instead.
export const BUILD_FACTORS = Object.freeze({
  elongate: 0.5,
  slender: 0.8,
  standard: 1.0,
  deep: 1.3,
  disc: 1.6,
});

// Shrimp: slender crustacean body and lower metabolic rate than a fish of the same length.
// Snails: size is shell size of a globular animal, so there is more tissue per inch than in a
// shrimp, offset by the inert shell and the lower metabolic rate of molluscs.
export const CATEGORY_FACTORS = Object.freeze({
  fish: 1.0,
  shrimp: 0.4,
  snail: 0.6,
});

// low: grazers / filter feeders that live mainly on biofilm, algae or suspended matter already
//      produced in the tank, so they add less new nitrogen than a fed animal of the same size.
// high: documented heavy waste producers for their size (e.g. wood/algae-grazing plecos, messy
//       carnivores). Every non-standard class needs a written rationale in the species record.
export const WASTE_FACTORS = Object.freeze({
  low: 0.75,
  standard: 1.0,
  high: 1.3,
});

const isPositive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

// Returns true when the inputs are complete and valid, otherwise a short reason string (the same
// convention as validateSpeciesRecord), so a record with bad inputs is rejected and flagged rather
// than calculated with a default.
export function validateBioloadInputs({ adultSizeIn, category, profile } = {}) {
  if (!isPositive(adultSizeIn)) return 'bad adult_size_in';
  if (!(category in CATEGORY_FACTORS)) return 'bad category';
  if (!profile || typeof profile !== 'object') return 'missing bioload_profile';
  if (!(profile.waste_class in WASTE_FACTORS)) return 'bad bioload_profile.waste_class';
  if (profile.waste_class !== 'standard' && !(typeof profile.rationale === 'string' && profile.rationale.trim())) {
    return 'bioload_profile.waste_class needs a rationale';
  }
  if (category === 'fish') {
    if (!(profile.body_build in BUILD_FACTORS)) return 'bad bioload_profile.body_build';
  } else if (profile.body_build != null) {
    return 'bioload_profile.body_build applies to fish only';
  }
  return true;
}

// Per-animal load in GE, or NaN when the inputs are invalid (never a fallback number).
export function computeSpeciesBioload({ adultSizeIn, category, profile } = {}) {
  if (validateBioloadInputs({ adultSizeIn, category, profile }) !== true) return NaN;
  const build = category === 'fish' ? BUILD_FACTORS[profile.body_build] : 1;
  return BIOLOAD_SCALE
    * adultSizeIn ** LENGTH_EXPONENT
    * build
    * CATEGORY_FACTORS[category]
    * WASTE_FACTORS[profile.waste_class];
}
