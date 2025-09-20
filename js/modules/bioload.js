// js/modules/bioload.js
import { readStock } from './species.js';

function totalBioUnits(){
  // simple 1 point per fish fallback unless you had a custom function
  return readStock().reduce((sum, it)=> sum + (it.qty||0), 0);
}
function capacityUnits(){
  const gallons = parseFloat(document.getElementById('gallons')?.value || '0') || 0;
  const planted = !!document.getElementById('planted')?.checked;
  const filt    = document.getElementById('filtration')?.value || 'standard';
  const perGal = 0.9;
  const filtFactor = (filt==='low') ? 0.80 : (filt==='high') ? 1.25 : 1.0;
  const plantedBonus = planted ? 1.10 : 1.0;
  return Math.max(1, gallons * perGal) * filtFactor * plantedBonus;
}

export function renderAllBars(){
  const bioloadBar = document.getElementById('bioBarFill');
  if (bioloadBar){
    const pct = Math.max(0, Math.min(160, (totalBioUnits()/capacityUnits())*100));
    bioloadBar.style.width = pct.toFixed(1) + '%';
  }
  // Aggression bar is handled by your aggression module; leave width as is if you don't have a score yet
}