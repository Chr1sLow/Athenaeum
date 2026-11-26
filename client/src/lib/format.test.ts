import { describe, expect, it } from 'vitest';
import { formatBytes } from './format.ts';

describe('formatBytes', () => {
  it('uses the largest unit that keeps the number above 1, with one decimal', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(12_800)).toBe('12.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(3.25 * 1024 ** 3)).toBe('3.3 GB');
  });
});
