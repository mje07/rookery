import { useState } from 'react';
import { db } from '../db/db';
import { useSettings, type BoardTheme } from '../lib/settings';
import { PageHeader } from '../components/ui';

const THEMES: { id: BoardTheme; label: string; light: string; dark: string }[] = [
  { id: 'slate', label: 'Slate', light: '#c9d1db', dark: '#7189a3' },
  { id: 'wood', label: 'Wood', light: '#ead9b7', dark: '#b58a5e' },
  { id: 'green', label: 'Green', light: '#e6ead2', dark: '#6f9a5c' },
  { id: 'ice', label: 'Ice', light: '#eef3f7', dark: '#8fb1c9' },
];

export default function Settings() {
  const s = useSettings();
  const [msg, setMsg] = useState('');

  const exportData = async () => {
    const dump: Record<string, unknown> = {};
    for (const t of db.tables) dump[t.name] = await t.toArray();
    const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rookery-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const dump = JSON.parse(await file.text()) as Record<string, unknown[]>;
      await db.transaction('rw', db.tables, async () => {
        for (const t of db.tables) {
          if (!Array.isArray(dump[t.name])) continue;
          await t.clear();
          await t.bulkPut(dump[t.name]);
        }
      });
      setMsg('Backup restored. Reloading…');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      setMsg(`Restore failed: ${(e as Error).message}`);
    }
  };

  const reset = async () => {
    if (!confirm('Delete ALL games, reviews, puzzle history, lesson progress and repertoires? This cannot be undone.')) return;
    await Promise.all(db.tables.map((t) => t.clear()));
    setMsg('All data cleared. Reloading…');
    setTimeout(() => location.reload(), 800);
  };

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader title="Settings" subtitle="Board appearance, analysis depth and your local data." />
      <div className="panel">
        <h3>Board</h3>
        <div className="btn-row">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className="btn"
              style={{ borderColor: s.boardTheme === t.id ? 'var(--accent)' : undefined, display: 'flex', gap: 8, alignItems: 'center' }}
              onClick={() => s.update({ boardTheme: t.id })}
            >
              <span style={{ width: 28, height: 28, borderRadius: 4, background: `conic-gradient(${t.light} 90deg, ${t.dark} 90deg 180deg, ${t.light} 180deg 270deg, ${t.dark} 270deg)`, backgroundSize: '50% 50%' }} />
              {t.label}
            </button>
          ))}
        </div>
        <label className="btn-row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={s.sound} onChange={(e) => s.update({ sound: e.target.checked })} /> Move sounds
        </label>
      </div>
      <div className="panel">
        <h3>Daily training</h3>
        <div className="tabs" style={{ marginBottom: 8 }}>
          {[20, 40, 60].map((m) => (
            <button key={m} className={`tab ${s.dailyMinutes === m ? 'active' : ''}`} onClick={() => s.update({ dailyMinutes: m })}>
              {m} min
            </button>
          ))}
        </div>
        <div className="muted small">
          How long today’s plan should take. More time means more puzzles and slower games, and faster progress.
        </div>
      </div>
      <div className="panel">
        <h3>Game Review</h3>
        <label className="field" style={{ maxWidth: 320 }}>
          Engine depth: {s.reviewDepth}
          <input type="range" min={10} max={20} value={s.reviewDepth} onChange={(e) => s.update({ reviewDepth: Number(e.target.value) })} />
        </label>
        <div className="muted small" style={{ marginTop: 6 }}>
          Higher is more accurate but slower. 14 takes roughly 20–60 seconds for a typical game.
        </div>
      </div>
      <div className="panel">
        <h3>Your data</h3>
        <p className="muted small">Everything is stored in this browser (IndexedDB). Back it up to move it to another browser or machine.</p>
        <div className="btn-row">
          <button className="btn" onClick={() => void exportData()}>Export backup</button>
          <label className="btn">
            Restore backup
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void importData(e.target.files[0])} />
          </label>
          <button className="btn danger" onClick={() => void reset()}>Reset everything</button>
        </div>
        {msg && <div className="muted small" style={{ marginTop: 8 }}>{msg}</div>}
      </div>
      <div className="panel muted small">
        <h3 style={{ color: 'var(--text)' }}>About</h3>
        Engine: Stockfish 19 (lite, WebAssembly, GPL-3). Puzzles and opening names: Lichess open databases (CC0). Board:
        chessground (GPL-3). Pieces: cburnett set (CC BY-SA 3.0).
      </div>
    </div>
  );
}
