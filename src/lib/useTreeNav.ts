import { useCallback, useEffect, useState } from 'react';
import { addMove, createTree, type MoveTree } from '../chess/tree';

/** State + navigation for a move tree, with ←/→/Home/End keyboard shortcuts. */
export function useTreeNav(initial?: MoveTree) {
  const [tree, setTree] = useState<MoveTree>(() => initial ?? createTree());
  const [currentId, setCurrentId] = useState<string>(() => (initial ?? tree).rootId);

  const reset = useCallback((t: MoveTree, at?: string) => {
    setTree(t);
    setCurrentId(at ?? t.rootId);
  }, []);

  const play = useCallback(
    (uci: string) => {
      const r = addMove(tree, currentId, uci);
      if (!r) return null;
      setTree(r.tree);
      setCurrentId(r.id);
      return r;
    },
    [tree, currentId],
  );

  const back = useCallback(() => {
    const p = tree.nodes[currentId]?.parent;
    if (p) setCurrentId(p);
  }, [tree, currentId]);
  const forward = useCallback(() => {
    const c = tree.nodes[currentId]?.children[0];
    if (c) setCurrentId(c);
  }, [tree, currentId]);
  const first = useCallback(() => setCurrentId(tree.rootId), [tree]);
  const last = useCallback(() => {
    let id = currentId;
    while (tree.nodes[id].children[0]) id = tree.nodes[id].children[0];
    setCurrentId(id);
  }, [tree, currentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') back();
      else if (e.key === 'ArrowRight') forward();
      else if (e.key === 'Home') first();
      else if (e.key === 'End') last();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, forward, first, last]);

  const node = tree.nodes[currentId] ?? tree.nodes[tree.rootId];
  return { tree, setTree, currentId, setCurrentId, node, play, back, forward, first, last, reset };
}
