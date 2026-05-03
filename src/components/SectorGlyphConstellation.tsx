import { SECTORS } from '../types';
import { SectorGlyphMark } from './icons/SectorGlyphs';

export function SectorGlyphConstellation() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2 text-ops-accent/10"
    >
      <span className="opacity-70 sm:hidden">
        <SectorGlyphMark sectorId={SECTORS[0].id} />
      </span>
      <span className="hidden items-center gap-2 sm:flex">
        {SECTORS.map((sector) => (
          <span key={sector.id} className="opacity-70">
            <SectorGlyphMark sectorId={sector.id} />
          </span>
        ))}
      </span>
    </div>
  );
}
