const HEATER_MAP = [
  { max: 10, watts: [25, 50] },
  { max: 20, watts: [75] },
  { max: 29, watts: [100] },
  { max: 40, watts: [150] },
  { max: 55, watts: [200] },
  { max: 75, watts: [250, 300] },
  { max: 90, watts: [300, 400] },
  { max: 110, watts: [400, 500] },
  { max: 125, watts: [500, 800] },
];

const TANK_LABELS = [
  { max: 5, label: '5g' },
  { max: 10, label: '10g' },
  { max: 20, label: '20g' },
  { max: 30, label: '29g' },
  { max: 40, label: '40 Breeder' },
  { max: 55, label: '55g' },
  { max: 75, label: '75g' },
  { max: 90, label: '90g' },
  { max: 110, label: '110g' },
  { max: 125, label: '125g' },
];

function extractWattage(specString) {
  if (!specString) {
    return [];
  }
  const matches = Array.from(specString.matchAll(/(\d{2,4})\s*W/gi));
  if (!matches.length) {
    return [];
  }
  return matches.map((match) => Number.parseInt(match[1], 10));
}

function labelForVolume(volume) {
  for (const item of TANK_LABELS) {
    if (volume <= item.max) {
      return item.label;
    }
  }
  return '125g';
}

export function mapHeaterToTanks(specString) {
  const watts = extractWattage(specString);
  const matchedTankLabels = new Set();
  let dualRecommended = false;
  const controllerHint = 'Recommend Inkbird controller';

  watts.forEach((watt) => {
    for (const mapping of HEATER_MAP) {
      if (mapping.watts.some((value) => Math.abs(value - watt) <= 10)) {
        matchedTankLabels.add(labelForVolume(mapping.max));
        if (mapping.max >= 90) {
          dualRecommended = true;
        }
      }
    }
  });

  return {
    matchedTankLabels: Array.from(matchedTankLabels),
    dualRecommended,
    controllerHint,
  };
}
