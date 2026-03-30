import { describe, expect, it } from 'vitest';

import {
  getNextStatus,
  getStatusCellText,
  getStatusLabel,
  getStatusShortLabel,
} from '../../src/lib/status';

describe('status helpers', () => {
  it('cycles unmarked to nominal to degraded and back to unmarked', () => {
    expect(getNextStatus('unmarked')).toBe('nominal');
    expect(getNextStatus('nominal')).toBe('degraded');
    expect(getNextStatus('degraded')).toBe('unmarked');
  });

  it('returns the correct labels and cell text for each status', () => {
    expect(getStatusLabel('unmarked')).toBe('UNMARKED');
    expect(getStatusLabel('nominal')).toBe('NOMINAL');
    expect(getStatusLabel('degraded')).toBe('DEGRADED');

    expect(getStatusShortLabel('unmarked')).toBe('UN');
    expect(getStatusShortLabel('nominal')).toBe('OK');
    expect(getStatusShortLabel('degraded')).toBe('DG');

    expect(getStatusCellText('unmarked')).toBe('UN');
    expect(getStatusCellText('nominal')).toBe('OK');
    expect(getStatusCellText('degraded')).toBe('DG');
  });
});
