function computeEnvFitAndWarnings(stock){
  // collect ranges from FISH_DATA
  const ranges = stock.map(item=>{
    const row = (window.FISH_DATA||[]).find(r => (r.name||'').toLowerCase() === (item.name||'').toLowerCase());
    return {
      temp: Array.isArray(row?.temp) && row.temp.length===2 ? [Number(row.temp[0]), Number(row.temp[1])] : null,
      ph:   Array.isArray(row?.ph)   && row.ph.length===2   ? [Number(row.ph[0]),   Number(row.ph[1])]   : null,
    };
  });

  const warnings = [];

  // If fewer than 2 species with ranges, we treat it as “fine” (no warnings and medium+ bar).
  const withTemp = ranges.filter(r=>r.temp);
  const withPh   = ranges.filter(r=>r.ph);

  function intersect(rangesArr, key){
    if(rangesArr.length===0) return null;
    let low  = -Infinity;
    let high =  Infinity;
    rangesArr.forEach(r => {
      low  = Math.max(low,  r[key][0]);
      high = Math.min(high, r[key][1]);
    });
    return (low<=high) ? [low, high] : null;
  }

  const tempOverlap = intersect(withTemp, 'temp');
  const phOverlap   = intersect(withPh,   'ph');

  // Scoring: start from 0, add 50 for temp overlap, 50 for pH overlap (cap 100)
  // If only one dimension exists, scale accordingly so single-dimension tanks still show a sensible bar.
  let score = 0;
  let denom = 0;
  if(withTemp.length >= 2){ denom += 50; score += tempOverlap ? 50 : 0; }
  if(withPh.length   >= 2){ denom += 50; score += phOverlap   ? 50 : 0; }
  // If denom is 0 (only one species or missing data), show neutral 60% (feels “compatible enough”).
  if(denom === 0) score = 60;

  // Hard warnings when overlap fails on an available dimension
  if(withTemp.length >= 2 && !tempOverlap){
    warnings.push('Temperature ranges do not overlap.');
  }
  if(withPh.length >= 2 && !phOverlap){
    warnings.push('pH ranges do not overlap.');
  }

  // If any severe env warning exists, you wanted the env bar to max to show “poor fit”.
  if(warnings.length){
    score = 100; // fill bar to the end (poor side) to visually flag the problem
  }

  return { score: Math.max(0, Math.min(100, score)), warnings };
}