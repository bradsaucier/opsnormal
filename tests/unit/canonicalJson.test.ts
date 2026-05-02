import { describe, expect, it } from 'vitest';

import {
  CanonicalJsonError,
  canonicalSerialize,
} from '../../src/lib/canonicalJson';

describe('canonicalSerialize', () => {
  it('serializes basic JSON values without whitespace', () => {
    expect(canonicalSerialize({})).toBe('{}');
    expect(canonicalSerialize({ a: 1 })).toBe('{"a":1}');
    expect(canonicalSerialize(null)).toBe('null');
    expect(canonicalSerialize(true)).toBe('true');
    expect(canonicalSerialize(false)).toBe('false');
  });

  it('sorts object keys independently at every level', () => {
    expect(
      canonicalSerialize({
        z: 3,
        a: {
          y: 2,
          b: 1,
        },
      }),
    ).toBe('{"a":{"b":1,"y":2},"z":3}');
  });

  it('drops undefined object values at top level and nested levels', () => {
    expect(
      canonicalSerialize({
        keep: true,
        omit: undefined,
        nested: {
          keep: 'yes',
          omit: undefined,
        },
      }),
    ).toBe('{"keep":true,"nested":{"keep":"yes"}}');
  });

  it('preserves array order', () => {
    expect(canonicalSerialize([3, { b: 2, a: 1 }, 'x'])).toBe(
      '[3,{"a":1,"b":2},"x"]',
    );
  });

  it('uses JSON string escaping', () => {
    const value = 'quote " slash \\ newline \n';

    expect(canonicalSerialize(value)).toBe(JSON.stringify(value));
  });

  it('serializes negative zero as zero', () => {
    expect(canonicalSerialize(-0)).toBe('0');
  });

  it('rejects cyclic objects', () => {
    const value: { self?: unknown } = {};
    value.self = value;

    expect(() => canonicalSerialize(value)).toThrow(CanonicalJsonError);
  });

  it('rejects cyclic arrays', () => {
    const value: unknown[] = [];
    value.push(value);

    expect(() => canonicalSerialize(value)).toThrow(CanonicalJsonError);
  });

  it('rejects sparse arrays', () => {
    const value = [1, 2, 3];
    Reflect.deleteProperty(value, '1');

    expect(() => canonicalSerialize(value)).toThrow(CanonicalJsonError);
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalSerialize(Number.NaN)).toThrow(CanonicalJsonError);
    expect(() => canonicalSerialize(Number.POSITIVE_INFINITY)).toThrow(
      CanonicalJsonError,
    );
    expect(() => canonicalSerialize(Number.NEGATIVE_INFINITY)).toThrow(
      CanonicalJsonError,
    );
  });

  it('rejects non-plain objects and unsupported values', () => {
    expect(() => canonicalSerialize(new Date())).toThrow(CanonicalJsonError);
    expect(() => canonicalSerialize(new Map())).toThrow(CanonicalJsonError);
    expect(() => canonicalSerialize(new Set())).toThrow(CanonicalJsonError);
    expect(() => canonicalSerialize(new Uint8Array())).toThrow(
      CanonicalJsonError,
    );
    expect(() => canonicalSerialize(() => undefined)).toThrow(
      CanonicalJsonError,
    );
  });

  it('is deterministic across randomized key insertion order', () => {
    const expected = '{"a":1,"b":2,"c":3,"d":4,"e":5}';

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const keys = ['a', 'b', 'c', 'd', 'e'].sort(() => Math.random() - 0.5);
      const value = Object.fromEntries(
        keys.map((key) => [key, key.charCodeAt(0) - 96]),
      );

      expect(canonicalSerialize(value)).toBe(expected);
    }
  });
});
