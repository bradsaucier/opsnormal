import { SECTORS } from '../types';
import { SectorGlyphMark } from './icons/SectorGlyphs';

export function SectorGlyphConstellation() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 items-center justify-end pr-5 text-ops-accent/10 sm:flex [&_svg]:h-6 [&_svg]:w-6"
    >
      <span className="flex items-center gap-3 opacity-70">
        {SECTORS.map((sector) => (
          <span key={sector.id} className="opacity-70">
            <SectorGlyphMark sectorId={sector.id} />
          </span>
        ))}
      </span>
    </div>
  );
}
