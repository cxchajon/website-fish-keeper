// js/modules/bioload.js
import { canonName } from './utils.js';
import { readStock } from './stock.js';

function lookupDataFor(name){
  const key = canonName(name);
  const src = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  if (!src) return null;

  if (Array.isArray(src)) {
    for (let i=0;i<src.length;i++){
      const row = src[i] || {};
      const n = canonName(row.name || row.species || row.common || '');
      if (n === key) return row;
    }
  } else if (typeof src === 'object') {
    const row = src[name] || src[key] || null;
    if (row) return row;
  }
  return null;
}

function parseInches(val){
  if (val == null) return 0;
  const s = String(val);
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function heuristicUnits(name){
  const n = canonName(name);
  if (/(shrimp|snail|daphnia|microrasbora|celestial pearl|cpd)/i.test(n)) return 0.2;
  if (/(ember tetra|neon tetra|cardinal tetra|harlequin rasbora|endlers?)/i.test(n)) return 0.6;
  if (/(guppy|platy|molly|danio|white cloud|corydoras|cory|kuhli)/i.test(n)) return 0.9;
  if (/(tetra|barb|rasbora)/i.test(n)) return 1.0;
  if (/(gourami|angelfish|rainbowfish|kribensis|ram|apistogramma)/i.test(n)) return 1.8;
  if (/(bristlenose|pleco|swordtail|larger rainbowfish)/i.test(n)) return 2.5;
  if (/(goldfish|oscar|severum|jack dempsey|convict|flowerhorn|common pleco)/i.test(n)) return 5.0;
  return 1.0;
}

function unitsFor(name){
  const row = lookupDataFor(name);
  const explicit = row && (row.bioUnits || row.bioload || row.bio_load);
  if (explicit && !isNaN(Number(explicit))) return Number(explicit);

  const maxIn = row && (row.maxInches || row.sizeInches || row.maxSizeIn || row.max_in);
  const inches = parseInches(maxIn);
  if (inches){
    if (inches <= 1.0) return 0.25;
    if (inches <= 1.5) return 0.5;
    if (inches <= 2.0) return 0.8;
    if (inches <= 3.0) return 1.1;
    if (inches <= 4.0) return 1.6;
    if (inches <= 5.0) return 2.2;
    if (inches <= 6.0) return 3.0;
    if (inches <= 8.0) return 4.2;
    return 5.5;
  }
  return heuristicUnits(name);
}

export function totalBioUnits(){
  return readStock().reduce((sum, item)=> sum + unitsFor(item.name) * (item.qty||0), 0);
}

export function capacityUnits(){
  const gallons = parseFloat(document.getElementById('gallons')?.value || '0') || 0;
  const planted = !!document.getElementById('planted')?.checked;
  const filtSel = document.getElementById('filtration');
  const filt = (filtSel && filtSel.value) || 'standard';
  const perGal = 0.9;
  const filtFactor = (filt==='low') ? 0.80 : (filt==='high') ? 1.25 : 1.0;
  const plantedBonus = planted ? 1.10 : 1.0;
  return Math.max(1, gallons * perGal) * filtFactor * plantedBonus;
}

export function renderBioload(){
  const bar = document.getElementById('bioBarFill');
  if(!bar) return;
  const total = totalBioUnits();
  const cap   = capacityUnits();
  const pct = Math.max(0, Math.min(160, (total / cap) * 100));
  bar.style.width = pct.toFixed(1) + '%';
}