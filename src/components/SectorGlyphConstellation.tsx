import { SECTORS } from '../types';
import { SectorGlyphMark } from './icons/SectorGlyphs';

export function SectorGlyphConstellation() {
  return (
    <div
      aria-hidden="true"
      className="ops-glyph-constellation pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2.5"
    >
      <span className="sm:hidden">
        <SectorGlyphMark sectorId={SECTORS[0].id} />
      </span>
      <span className="hidden items-center gap-2 sm:flex">
        {SECTORS.map((sector) => (
          <span key={sector.id}>
            <SectorGlyphMark sectorId={sector.id} />
          </span>
        ))}
      </span>
    </div>
  );
}
