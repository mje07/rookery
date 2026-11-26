export interface OpeningName {
  eco: string;
  name: string;
}

export interface OpeningBook {
  /** Named opening at exactly this position. */
  nameAt(fen: string): OpeningName | undefined;
  /** Position occurs within some named opening line. */
  inBook(fen: string): boolean;
  /** All named lines: [eco, name, uci moves]. */
  lines: [string, string, string][];
}

export const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

let cache: Promise<OpeningBook> | null = null;

export function loadBook(): Promise<OpeningBook> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/openings.json`)
    .then((r) => r.json())
    .then((d: { positions: Record<string, [string, string]>; lines: [string, string, string][]; book: string[] }) => {
      const book = new Set(d.book);
      return {
        nameAt: (fen: string) => {
          const p = d.positions[epd(fen)];
          return p ? { eco: p[0], name: p[1] } : undefined;
        },
        inBook: (fen: string) => book.has(epd(fen)),
        lines: d.lines,
      };
    });
  return cache;
}

/** Deepest named opening reached along a sequence of FENs. */
export function openingOf(book: OpeningBook, fens: string[]): OpeningName | undefined {
  let found: OpeningName | undefined;
  for (const f of fens) {
    const n = book.nameAt(f);
    if (n) found = n;
    else if (!book.inBook(f)) break;
  }
  return found;
}
