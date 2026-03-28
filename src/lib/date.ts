export function formatDateKey(date: Date = new Date()): string {
  const year = date.getFullYear().toString();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return new Date(year, month - 1, day);
}

export function getTrailingDateKeys(days: number, today: Date = new Date()): string[] {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateKeys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() - offset);
    dateKeys.push(formatDateKey(candidate));
  }

  return dateKeys;
}

export function formatDayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'numeric',
    day: 'numeric'
  }).format(parseDateKey(dateKey));
}

export function formatLongDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parseDateKey(dateKey));
}
