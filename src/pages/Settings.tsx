import { useEffect, useState } from 'react';
import { GoalForm } from '../features/path/GoalForm';
import { loadProfile, saveProfile, type Profile } from '../features/path/profile';
import { db } from '../db/db';
import { REVIEW_NODES, useSettings, type BoardTheme } from '../lib/settings';
import { analysisEngine } from '../engine/EngineService';

function engineStatus(): string {
  const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
  const info = analysisEngine().getInfo();
  const cores = navigator.hardwareConcurrency || 1;
  if (!isolated) return 'Running single-threaded (this browser or page doesn’t allow shared memory).';
  return info
    ? `Running on ${info.threads} thread${info.threads > 1 ? 's' : ''}, ${info.hashMb} MB hash.`
    : `Will use up to ${Math.max(1, Math.min(cores - 1, 8))} threads.`;
}
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
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [goalMsg, setGoalMsg] = useState('');
  useEffect(() => {
    void loadProfile().then(setProfile);
  }, []);

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
      <PageHeader title="Settings" subtitle="Your goal, board, engine and your local data." />
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
              <span style={{ width: 28, height: 28, borderRadius: 4, background: `conic-gradient(${t.dark} 90deg, ${t.light} 90deg 180deg, ${t.dark} 180deg 270deg, ${t.light} 270deg)`, backgroundSize: '50% 50%' }} />
              {t.label}
            </button>
          ))}
        </div>
        <label className="btn-row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={s.sound} onChange={(e) => s.update({ sound: e.target.checked })} /> Move sounds
        </label>
      </div>
      <div className="panel">
        <h3>Your level & goal</h3>
        {profile !== undefined && (
          <GoalForm
            key={profile?.setAt ?? 0}
            initial={profile ?? undefined}
            submitLabel={profile ? 'Update plan' : 'Build my plan'}
            onSubmit={async (start, goal) => {
              setProfile(await saveProfile(start, goal));
              setGoalMsg('Saved. Your roadmap on the Today page now covers this range.');
            }}
          />
        )}
        {goalMsg && <div className="muted small" style={{ marginTop: 8 }}>{goalMsg}</div>}
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
        <h3>Engine</h3>
        <div className="tabs" style={{ marginBottom: 8 }}>
          {(
            [
              ['fast', 'Fast (1.7 MB)'],
              ['strong', 'Strong (94 MB download)'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`tab ${s.engine === id ? 'active' : ''}`} onClick={() => s.update({ engine: id })}>
              {label}
            </button>
          ))}
        </div>
        <div className="muted small">
          Both are Stockfish 19. “Strong” uses the full neural network: noticeably more accurate on deep tactics, but it
          downloads once (~94 MB, then cached) and searches more slowly. {engineStatus()}
        </div>
      </div>
      <div className="panel">
        <h3>Game Review quality</h3>
        <div className="tabs" style={{ marginBottom: 8 }}>
          {(
            [
              ['quick', 'Quick'],
              ['standard', 'Standard'],
              ['deep', 'Deep'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`tab ${s.reviewQuality === id ? 'active' : ''}`} onClick={() => s.update({ reviewQuality: id })}>
              {label} · {Math.round(REVIEW_NODES[id] / 1000)}k nodes
            </button>
          ))}
        </div>
        <div className="muted small">
          How hard the engine looks at each position. Standard suits most games; Deep is best for sharp tactical games.
          Existing reviews are kept; use “Re-run analysis” on a game to redo it at the new quality.
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
