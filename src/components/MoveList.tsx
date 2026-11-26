import { Fragment, useEffect, useRef } from 'react';
import { isWhiteMove, moveNumberLabel, type MoveTree } from '../chess/tree';
import { ClassIcon } from '../features/review/ClassIcon';
import type { Classification } from '../features/review/types';

export interface MoveMark {
  cls: Classification;
}

interface Props {
  tree: MoveTree;
  currentId: string;
  onSelect: (id: string) => void;
  marks?: Record<string, MoveMark>;
  onContext?: (id: string, ev: React.MouseEvent) => void;
}

/** PGN-style move list with nested variations in parentheses. */
export function MoveList({ tree, currentId, onSelect, marks, onContext }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector('.mv.active')?.scrollIntoView({ block: 'nearest' });
  }, [currentId]);

  const renderMove = (id: string, forceNumber: boolean) => {
    const n = tree.nodes[id];
    const before = tree.nodes[n.parent!].fen;
    const white = isWhiteMove(before);
    const mark = marks?.[id];
    return (
      <Fragment key={id}>
        {(white || forceNumber) && <span className="mv-num">{moveNumberLabel(before)}</span>}
        <span
          className={`mv ${id === currentId ? 'active' : ''}`}
          onClick={() => onSelect(id)}
          onContextMenu={(e) => {
            if (onContext) {
              e.preventDefault();
              onContext(id, e);
            }
          }}
        >
          {n.san}
          {mark && (
            <span className="mv-mark"><ClassIcon cls={mark.cls} size={14} /></span>
          )}
        </span>
        {n.comment && <span className="mv-comment">{n.comment}</span>}
      </Fragment>
    );
  };

  // Render the line starting at `startId` (a move node), with sidelines of each node's parent.
  const renderLine = (startId: string, depth: number): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let id: string | undefined = startId;
    let forceNumber = true;
    while (id) {
      const node: (typeof tree.nodes)[string] = tree.nodes[id];
      out.push(renderMove(id, forceNumber));
      forceNumber = false;
      const parent = tree.nodes[node.parent!];
      // Sidelines branching from the same parent (alternatives to this move).
      const siblings = parent.children[0] === id ? parent.children.slice(1) : [];
      if (siblings.length) {
        for (const s of siblings) {
          out.push(
            <span key={`v${s}`} className={`variation depth-${Math.min(depth, 3)}`}>
              ({renderLine(s, depth + 1)})
            </span>,
          );
        }
        forceNumber = true;
      }
      id = node.children[0];
    }
    return out;
  };

  const root = tree.nodes[tree.rootId];
  return (
    <div className="move-list" ref={box}>
      {root.children[0] ? renderLine(root.children[0], 0) : <span className="muted">No moves yet.</span>}
    </div>
  );
}
