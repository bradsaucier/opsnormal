import type { ReactNode } from 'react';

import type { SectorId } from '../../types';

interface SectorGlyphProps {
  children: ReactNode;
}

function SectorGlyph({ children }: SectorGlyphProps) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.5"
      viewBox="0 0 16 16"
      width="16"
      height="16"
    >
      {children}
    </svg>
  );
}

export function SectorGlyphMark({ sectorId }: { sectorId: SectorId }) {
  if (sectorId === 'work-school') {
    return (
      <SectorGlyph>
        <path d="M3 4.5h10M3 8h10M3 11.5h10" />
        <path d="M8 3v10" />
      </SectorGlyph>
    );
  }

  if (sectorId === 'household') {
    return (
      <SectorGlyph>
        <path d="M4 4h8v8H4z" />
        <path d="M6 6h4v4H6z" />
      </SectorGlyph>
    );
  }

  if (sectorId === 'relationships') {
    return (
      <SectorGlyph>
        <path d="M3.5 8h9" />
        <path d="M5 5.5h3v5H5z" />
        <path d="M8 5.5h3v5H8z" />
      </SectorGlyph>
    );
  }

  if (sectorId === 'body') {
    return (
      <SectorGlyph>
        <path d="M8 3v10" />
        <path d="M4.5 5.5h7" />
        <path d="M5.5 10.5h5" />
      </SectorGlyph>
    );
  }

  return (
    <SectorGlyph>
      <path d="M4 4h8" />
      <path d="M5 8h6" />
      <path d="M6 12h4" />
    </SectorGlyph>
  );
}
