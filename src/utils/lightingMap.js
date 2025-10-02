const LENGTH_TO_TANKS = new Map([
  [12, ['5g']],
  [15, ['5g', '10g']],
  [18, ['10g']],
  [20, ['10g', '20g']],
  [24, ['20g', '20 Long', '29g']],
  [30, ['29g', '37g']],
  [36, ['40 Breeder', '55g']],
  [48, ['55g', '75g', '90g']],
  [60, ['110g']],
  [72, ['125g']],
]);

const RANGE_HINTS = [
  { min: 24, max: 36, tanks: ['20 Long', '29g', '40 Breeder'] },
  { min: 36, max: 48, tanks: ['55g', '75g', '90g'] },
  { min: 24, max: 34, tanks: ['20 Long', '29g'] },
  { min: 36, max: 48, tanks: ['40 Breeder', '55g', '75g'] },
];

function parseInches(specString) {
  if (!specString) {
    return [];
  }
  const matches = Array.from(specString.matchAll(/(\d+(?:\.\d+)?)\s*(?:\u2033|\"|in|inch)/gi));
  if (matches.length >= 2) {
    const values = matches.map((match) => Number.parseFloat(match[1]));
    return values.sort((a, b) => a - b);
  }
  const simple = specString.match(/(\d+(?:\.\d+)?)\s*(?:\u2033|\"|in|inch)/i);
  if (simple) {
    return [Number.parseFloat(simple[1])];
  }
  return [];
}

export function mapLightToTanks(specString, explicitTank) {
  const inches = parseInches(specString);
  const matchedTankLabels = new Set();
  let dualSuggestion = false;
  let note;

  if (explicitTank) {
    matchedTankLabels.add(explicitTank);
  }

  if (inches.length === 2) {
    const [min, max] = inches;
    RANGE_HINTS.forEach((hint) => {
      if (min <= hint.max && max >= hint.min) {
        hint.tanks.forEach((tank) => matchedTankLabels.add(tank));
      }
    });
  }

  inches.forEach((inch) => {
    const rounded = Math.round(inch);
    if (LENGTH_TO_TANKS.has(rounded)) {
      LENGTH_TO_TANKS.get(rounded).forEach((tank) => matchedTankLabels.add(tank));
    }
  });

  if (inches.length === 1) {
    const length = Math.round(inches[0]);
    if (!matchedTankLabels.size) {
      if (length > 48 && length < 60) {
        matchedTankLabels.add('90g');
        matchedTankLabels.add('110g');
      } else if (length >= 60) {
        matchedTankLabels.add('125g');
      }
    }
    if (length === 48) {
      dualSuggestion = true;
      note = 'Consider dual fixtures or higher spread optics for 48" tanks.';
    }
  }

  return {
    matchedTankLabels: Array.from(matchedTankLabels),
    dualSuggestion,
    note,
  };
}
