import { CLASS_META } from './classMeta';
import { classIconSvg } from './classIcons';
import type { Classification } from './types';

/** Move-quality icon (same artwork as the board badge). */
export function ClassIcon({ cls, size = 20, title }: { cls: Classification; size?: number; title?: string }) {
  return (
    <span
      className="class-icon"
      role="img"
      aria-label={title ?? CLASS_META[cls].label}
      title={title ?? CLASS_META[cls].label}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: classIconSvg(cls, size) }}
    />
  );
}
