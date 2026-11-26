import type { Classification } from './types';
import { CLASS_META } from './classMeta';

/*
 * Move-quality icons, drawn as SVG paths in a 24×24 box (no font glyphs, so they centre identically everywhere).
 * Stroke style follows lucide (round caps/joins). Book and thumbs-up shapes are adapted from lucide (ISC).
 */

const S = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';

const bang = (x: number) => `<path d="M${x} 6.6v6.6" ${S} stroke-width="2.7"/><circle cx="${x}" cy="17.3" r="1.55" fill="#fff"/>`;
const query = (x: number) =>
  `<path d="M${x - 2.45} 8.75a2.5 2.5 0 1 1 3.55 2.28c-.62.33-1.1.86-1.1 1.6v.62" ${S} stroke-width="2.5"/>` +
  `<circle cx="${x}" cy="17.3" r="1.5" fill="#fff"/>`;

const INNER: Record<Classification, string> = {
  brilliant: bang(9) + bang(15),
  great: bang(12),
  best: `<path d="M12 5.6l1.95 3.95 4.36.64-3.16 3.08.75 4.34L12 15.56l-3.9 2.05.75-4.34-3.16-3.08 4.36-.64z" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>`,
  excellent:
    `<g transform="translate(5.6 5.4) scale(.54)"><path d="M7 10v12" ${S} stroke-width="3.6"/>` +
    `<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" ${S} stroke-width="3.6"/></g>`,
  good: `<path d="M7.4 12.4l3.1 3.1 6.1-6.6" ${S} stroke-width="2.8"/>`,
  book:
    `<g transform="translate(5.5 5.8) scale(.54)"><path d="M12 7v14" ${S} stroke-width="3.4"/>` +
    `<path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" ${S} stroke-width="3.4"/></g>`,
  inaccuracy: query(9.3) + bang(15.6),
  mistake: query(12),
  miss: `<path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" ${S} stroke-width="2.8"/>`,
  blunder: query(8.9) + query(15.3),
};

/** Coloured disc + white symbol, 24×24 user units (no outer <svg>). */
export function classIconGroup(cls: Classification, ring = false): string {
  const color = CLASS_META[cls].color;
  return (
    (ring ? `<circle cx="12" cy="12.8" r="12" fill="rgba(0,0,0,.35)"/><circle cx="12" cy="12" r="12" fill="#fff"/>` : '') +
    `<circle cx="12" cy="12" r="${ring ? 10.6 : 12}" fill="${color}"/>` +
    INNER[cls]
  );
}

/** Standalone SVG markup at a given pixel size. */
export function classIconSvg(cls: Classification, size = 20): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${classIconGroup(cls)}</svg>`;
}

/**
 * Board badge for chessground's customSvg (origin = top-left of the square, 100 units per square).
 * Sits inside the square's top-right corner so it is never clipped at the board edge.
 */
export function classBadgeSvg(cls: Classification): string {
  return `<g transform="translate(60 2) scale(1.55)">${classIconGroup(cls, true)}</g>`;
}
