import { Fragment } from 'react';

/** Minimal formatter for lesson text: paragraphs, "- " bullets, "1. " numbered lists, **bold**, *italic*. */
export function RichText({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
      part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part.startsWith('*') && part.length > 2 ? <i key={i}>{part.slice(1, -1)}</i> : <Fragment key={i}>{part}</Fragment>,
    );
  return (
    <div className="lesson-text">
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.trim().split('\n');
        if (lines.every((l) => /^\s*-\s/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*-\s/, ''))}</li>)}</ul>;
        if (lines.every((l) => /^\s*\d+\.\s/.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+\.\s/, ''))}</li>)}</ol>;
        return <p key={i}>{inline(block.trim())}</p>;
      })}
    </div>
  );
}
