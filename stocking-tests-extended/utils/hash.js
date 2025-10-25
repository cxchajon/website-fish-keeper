import { createHash } from 'crypto';

export function hashSpeciesLibrary(speciesList) {
  const hash = createHash('sha256');
  const sorted = [...speciesList].sort((a, b) => a.id.localeCompare(b.id));
  for (const species of sorted) {
    hash.update(species.id ?? '');
    hash.update('|');
    hash.update(String(species.commonName ?? ''));
    hash.update('|');
    hash.update(String(species.salinity ?? ''));
    hash.update('|');
    hash.update(String(species.aggression ?? ''));
    hash.update('|');
    hash.update(String(species.minTemp ?? ''));
    hash.update('|');
    hash.update(String(species.maxTemp ?? ''));
  }
  return hash.digest('hex');
}
