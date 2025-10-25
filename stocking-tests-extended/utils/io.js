import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function readJson(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, content);
}

export function writeCsv(filePath, headers, rows) {
  const allRows = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header] ?? '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    allRows.push(values.join(','));
  }
  writeText(filePath, `${allRows.join('\n')}\n`);
}
