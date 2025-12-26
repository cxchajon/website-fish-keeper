/**
 * @typedef {'low' | 'moderate' | 'high'} ActivityLevel
 *
 * @typedef {{ min: number, max: number }} Range
 *
 * @typedef {{
 *   id: string,
 *   commonName: string,
 *   scientificName: string,
 *   category: 'fish' | 'shrimp' | 'snail',
 *   temperature: Range,
 *   ph: Range,
 *   gH: Range,
 *  kH: Range,
 *   salinity: 'fresh' | 'brackish-low' | 'brackish-high' | 'dual',
 *   aggression: number,
 *   finNipper: boolean,
 *   longFin: boolean,
 *   shrimpUnsafe: boolean,
 *   invertSafe: boolean,
 *   activity: ActivityLevel,
 *   baseBioload: number,
 *   behaviorTags: string[],
 *   tags: string[],
 *   shoalMin: number | null,
 *   minGroup: number | null,
 * }} NormalizedSpecies
 *
 * @typedef {{ speciesId: string, count: number }} StockingEntry
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   gallons: number,
 *   entries: StockingEntry[],
 * }} StockingPlan
 *
 * @typedef {{ ok: boolean, warnings: string[], blockers: string[] }} CompatibilityResult
 *
 * @typedef {{ totalBioload: number, capacity: number, percent: number }} BioloadResult
 *
 * @typedef {{ gallons: number, gph: number, turnoverX: number, recommendation: Range }} TurnoverResult
 *
 * @typedef {{ id: string, issues: string[] }} AdapterIssue
 */
export const ActivityLevels = ['low', 'moderate', 'high'];
