import type { Classification } from './types';

export const CLASS_META: Record<Classification, { label: string; glyph: string; color: string }> = {
  brilliant: { label: 'Brilliant', glyph: '!!', color: '#9b4dca' },
  great: { label: 'Great', glyph: '!', color: '#3b7ddd' },
  best: { label: 'Best', glyph: '★', color: '#2f9e57' },
  excellent: { label: 'Excellent', glyph: '✓', color: '#5fae5a' },
  good: { label: 'Good', glyph: '+', color: '#8fae6a' },
  book: { label: 'Book', glyph: '≡', color: '#9a7b58' },
  inaccuracy: { label: 'Inaccuracy', glyph: '?!', color: '#d9a400' },
  mistake: { label: 'Mistake', glyph: '?', color: '#e5772b' },
  miss: { label: 'Miss', glyph: '✗', color: '#d9508a' },
  blunder: { label: 'Blunder', glyph: '??', color: '#cf2e2e' },
};

/** Classifications worth stepping through as "key moments". */
export const KEY_CLASSES: Classification[] = ['brilliant', 'great', 'miss', 'blunder', 'mistake', 'inaccuracy'];
