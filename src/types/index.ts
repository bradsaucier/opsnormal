export const SECTORS = [
  {
    id: 'work-school',
    label: 'Work or School',
    shortLabel: 'WORK',
    description: 'Professional load, classwork, deadlines, and mission focus.'
  },
  {
    id: 'household',
    label: 'Household',
    shortLabel: 'HOME',
    description: 'Admin, maintenance, chores, and domestic follow-through.'
  },
  {
    id: 'relationships',
    label: 'Relationships',
    shortLabel: 'RELS',
    description: 'Partnership, family, and close human connection.'
  },
  {
    id: 'body',
    label: 'Body',
    shortLabel: 'BODY',
    description: 'Exercise, nutrition, hygiene, and physical maintenance.'
  },
  {
    id: 'rest',
    label: 'Rest',
    shortLabel: 'REST',
    description: 'Sleep, downtime, decompression, and recovery margin.'
  }
] as const;

export type Sector = (typeof SECTORS)[number];
export type SectorId = Sector['id'];

export type EntryStatus = 'nominal' | 'degraded';
export type UiStatus = EntryStatus | 'unmarked';

export interface DailyEntry {
  id?: number;
  date: string;
  sectorId: SectorId;
  status: EntryStatus;
  updatedAt: string;
}
