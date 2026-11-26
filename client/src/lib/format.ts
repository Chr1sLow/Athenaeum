/** 12345 → "12,345". */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** "1 book", "3 books". */
export function bookCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'book' : 'books'}`;
}

/** Reading time at ~250 words per minute, never less than a minute. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / 250));
}

/** 12800 → "12.5 KB". Binary units (1 KB = 1024 bytes), at most one decimal. */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : Number(value.toFixed(1))} ${units[unit]}`;
}
