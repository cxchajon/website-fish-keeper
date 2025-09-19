// js/modules/status.js
export function statusCheck(){
  const diag = document.getElementById('diag');
  if (!diag) return; // no strip, nothing to do
  const box = diag.querySelector('div');
  const show = (ok,msg) => { diag.className = ok ? 'ok' : 'err'; box.textContent = msg; };

  const issues = [];
  if (!document.getElementById('fishSelect')) issues.push('Species dropdown missing');
  if (!document.getElementById('tbody')) issues.push('Table body missing');
  const fishData = window.FISH_DATA || window.fishData || window.fish_list || window.SPECIES;
  if (!fishData) issues.push('No global species list found');

  if (issues.length) show(false, 'Issues: ' + issues.join(' | '));
  else show(true, 'Core OK • Safety adapter ready');
}