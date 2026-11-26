import type { Classification } from './types';

export const CLASS_META: Record<Classification, { label: string; color: string }> = {
  brilliant: { label: 'Brilliant', color: '#9b4dca' },
  great: { label: 'Great', color: '#3b7ddd' },
  best: { label: 'Best', color: '#2f9e57' },
  excellent: { label: 'Excellent', color: '#5fae5a' },
  good: { label: 'Good', color: '#8fae6a' },
  book: { label: 'Book', color: '#9a7b58' },
  inaccuracy: { label: 'Inaccuracy', color: '#d9a400' },
  mistake: { label: 'Mistake', color: '#e5772b' },
  miss: { label: 'Miss', color: '#d9508a' },
  blunder: { label: 'Blunder', color: '#cf2e2e' },
};

/** Classifications worth stepping through as "key moments". */
export const KEY_CLASSES: Classification[] = ['brilliant', 'great', 'miss', 'blunder', 'mistake', 'inaccuracy'];
