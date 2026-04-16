import { describe, expect, it } from 'vitest';

import {
  getNextStatus,
  getStatusCellText,
  getStatusContent,
  getStatusLabel,
  getStatusScreenReaderHint,
  getStatusShortLabel,
} from '../../src/lib/status';
import type { UiStatus } from '../../src/types';

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

  it('returns a complete content record for each status', () => {
    const statuses: UiStatus[] = ['unmarked', 'nominal', 'degraded'];

    for (const status of statuses) {
      const content = getStatusContent(status);

      expect(content).toHaveProperty('label');
      expect(content).toHaveProperty('shortLabel');
      expect(content).toHaveProperty('cell');
      expect(content).toHaveProperty('classes');
      expect(content).toHaveProperty('srHint');
      expect(content.label).toBe(getStatusLabel(status));
      expect(content.shortLabel).toBe(getStatusShortLabel(status));
      expect(content.cell).toBe(getStatusCellText(status));
    }

    expect(getStatusContent('nominal').classes).toBe('ops-status-nominal');
    expect(getStatusContent('degraded').classes).toBe('ops-status-degraded');
    expect(getStatusContent('unmarked').classes).toBe('ops-status-unmarked');
  });

  it('returns a screen reader hint for each status', () => {
    expect(getStatusScreenReaderHint('nominal')).toBe('Nominal status.');
    expect(getStatusScreenReaderHint('degraded')).toBe('Degraded status.');
    expect(getStatusScreenReaderHint('unmarked')).toBe('Unmarked status.');
  });
});
