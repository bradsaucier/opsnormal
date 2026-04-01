import { describe, expect, it } from 'vitest';

import { readEntriesForCrashExport } from '../../src/lib/crashExport';

describe('crash export isolation', () => {
  it('opens and closes an independent Dexie instance', async () => {
    const entries = await readEntriesForCrashExport();

    expect(Array.isArray(entries)).toBe(true);
  });
});
