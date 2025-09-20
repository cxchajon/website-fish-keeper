/* ---------- Environmental Fit (badness that fills to the right) ---------- */
function envFitScoreAndBubbles(){
  const stock = readStock();
  const chosen = stock
    .map(s => findRow(s.name))
    .filter(r => r && Array.isArray(r.temp) && r.temp.length===2 && Array.isArray(r.ph) && r.ph.length===2);

  const bubbles = [];
  if (chosen.length < 2) return { bad: 0, bubbles }; // nothing to compare

  // Try group-wide intersection first
  const tAll = interAll(chosen.map(r => r.temp));
  const pAll = interAll(chosen.map(r => r.ph));

  // If either dimension fails anywhere, find a conflicting pair and mark SEVERE
  if (!tAll || !pAll) {
    // Pick one explicit conflicting pair for a useful message
    let pick = null;
    for (let i=0;i<chosen.length;i++){
      for (let j=i+1;j<chosen.length;j++){
        const a = chosen[i], b = chosen[j];
        const t = inter2(a.temp,b.temp);
        const p = inter2(a.ph,b.ph);
        if (!t || !p) { pick = [a,b,t,p]; break; }
      }
      if (pick) break;
    }
    if (pick){
      const [a,b,t,p] = pick;
      const msgs = [];
      if (!t) msgs.push(`Temp clash (${fmtRange(a.temp,'°F')} vs ${fmtRange(b.temp,'°F')})`);
      if (!p) msgs.push(`pH clash (${fmtRange(a.ph,'')} vs ${fmtRange(b.ph,'')})`);
      bubbles.push(['severe', `${a.name} ↔ ${b.name}: ${msgs.join(' • ')}`]);
    } else {
      bubbles.push(['severe', 'Temperature or pH ranges do not overlap.']);
    }
    return { bad: 100, bubbles };  // bar maxes to show *poor* fit
  }

  // We have an overall intersection: compute *goodness*, then invert to badness
  // Scale: 30°F span ⇒ 100% good; 3.0 pH span ⇒ 100% good
  const tGood = clamp(span(tAll)/30, 0, 1);
  const pGood = clamp(span(pAll)/3 , 0, 1);
  const goodness = (tGood*0.55 + pGood*0.45) * 100;

  // Badness is the right-filling value for the UI
  const bad = clamp(100 - goodness, 0, 100);

  // Optional gentle note when the overlap is tight but not a clash
  if (bad >= 75) bubbles.push(['moderate','Very tight overlap in temperature & pH.']);

  return { bad, bubbles };
}

function renderEnv(){
  if (!envBar) return;
  const { bad } = envFitScoreAndBubbles();
  envBar.style.width = bad.toFixed(1) + '%';   // higher = poorer fit (fills right)
}
