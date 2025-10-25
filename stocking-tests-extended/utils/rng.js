export class LcgRng {
  constructor(seedValue = Date.now()) {
    this.state = seedValue >>> 0;
    if (this.state === 0) {
      this.state = 0x1a2b3c4d;
    }
  }

  next() {
    // Numerical Recipes constants
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state;
  }

  nextFloat() {
    return this.next() / 0xffffffff;
  }

  pick(array) {
    if (!Array.isArray(array) || array.length === 0) {
      return undefined;
    }
    const idx = Math.floor(this.nextFloat() * array.length);
    return array[idx];
  }

  shuffle(array) {
    const list = Array.isArray(array) ? [...array] : [];
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
}

export function seedFromString(value) {
  const str = String(value ?? '');
  if (!str) {
    return 0x12345678;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}
