function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

export function markdownTable(headers, rows) {
  const headerLine = `| ${headers.map(escapePipe).join(' | ')} |`;
  const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rowLines = rows.map((row) => `| ${headers.map((header) => escapePipe(row[header])).join(' | ')} |`);
  return [headerLine, dividerLine, ...rowLines].join('\n');
}

export function formatPercent(value, fractionDigits = 1) {
  if (!Number.isFinite(value)) {
    return '0.0%';
  }
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatNumber(value, fractionDigits = 1) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value.toFixed(fractionDigits);
}

export function renderHeatmapRow(dimension, data) {
  const { tested = 0, skipped = 0, failCount = 0 } = data ?? {};
  const status = failCount > 0 ? '✗' : skipped > 0 && tested === 0 ? '–' : '✓';
  return {
    Dimension: dimension,
    Tested: tested,
    Skipped: skipped,
    Failures: failCount,
    Status: status,
  };
}
