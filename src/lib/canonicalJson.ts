export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalJsonError';
  }
}

export function canonicalSerialize(value: unknown): string {
  return serializeCanonicalValue(value, new WeakSet<object>());
}

function serializeCanonicalValue(
  value: unknown,
  ancestors: WeakSet<object>,
): string {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return serializeNumber(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'object':
      return Array.isArray(value)
        ? serializeArray(value, ancestors)
        : serializeObject(value, ancestors);
    default:
      throw new CanonicalJsonError('Unsupported JSON value.');
  }
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CanonicalJsonError('Unsupported non-finite JSON number.');
  }

  return Object.is(value, -0) ? '0' : value.toString();
}

function serializeArray(value: unknown[], ancestors: WeakSet<object>): string {
  if (ancestors.has(value)) {
    throw new CanonicalJsonError('Cannot canonicalize cyclic JSON.');
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      throw new CanonicalJsonError('Cannot canonicalize sparse JSON arrays.');
    }
  }

  ancestors.add(value);

  try {
    return `[${value.map((item) => serializeCanonicalValue(item, ancestors)).join(',')}]`;
  } finally {
    ancestors.delete(value);
  }
}

function serializeObject(value: object, ancestors: WeakSet<object>): string {
  const prototype: unknown = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalJsonError('Unsupported non-plain JSON object.');
  }

  if (ancestors.has(value)) {
    throw new CanonicalJsonError('Cannot canonicalize cyclic JSON.');
  }

  ancestors.add(value);

  try {
    const record = value as Record<string, unknown>;
    const serializedEntries = Object.keys(record)
      .sort()
      .flatMap((key) =>
        record[key] === undefined
          ? []
          : [
              `${JSON.stringify(key)}:${serializeCanonicalValue(
                record[key],
                ancestors,
              )}`,
            ],
      );

    return `{${serializedEntries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}
