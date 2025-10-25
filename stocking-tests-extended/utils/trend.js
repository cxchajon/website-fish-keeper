import { readJson, writeJson } from './io.js';

export function loadTrendHistory(filePath) {
  const data = readJson(filePath);
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

export function appendTrendEntry(filePath, entry) {
  const history = loadTrendHistory(filePath);
  history.push(entry);
  writeJson(filePath, history);
  return history;
}

export function computeTrendDelta(previous, current) {
  if (!previous) {
    return {
      speciesDelta: current.totalSpecies,
      failRateDelta: current.failRate,
      pairsDelta: current.totalPairsTested,
    };
  }
  return {
    speciesDelta: current.totalSpecies - previous.totalSpecies,
    failRateDelta: current.failRate - previous.failRate,
    pairsDelta: current.totalPairsTested - previous.totalPairsTested,
  };
}
