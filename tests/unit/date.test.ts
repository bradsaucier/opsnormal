import { describe, expect, it } from 'vitest';

import {
  formatDateKey,
  getTrailingDateKeys,
  parseDateKey,
} from '../../src/lib/date';

describe('date helpers', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    const date = new Date(2026, 2, 27, 15, 45, 0);
    expect(formatDateKey(date)).toBe('2026-03-27');
  });

  it('creates trailing date keys in ascending order', () => {
    const date = new Date(2026, 2, 27, 9, 0, 0);
    expect(getTrailingDateKeys(3, date)).toEqual([
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
    ]);
  });

  it('parses a date key to local midnight', () => {
    const parsed = parseDateKey('2026-03-27');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2);
    expect(parsed.getDate()).toBe(27);
  });
});
