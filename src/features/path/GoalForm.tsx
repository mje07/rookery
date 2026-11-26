import { useState } from 'react';
import { Target } from 'lucide-react';
import { LEVEL_PRESETS } from './profile';
import { MAX_RATING, MIN_RATING, pathStages } from './stages';

interface Props {
  initial?: { start: number; goal: number };
  submitLabel?: string;
  onSubmit: (start: number, goal: number) => void | Promise<void>;
  onCancel?: () => void;
}

/** Pick your current level and a goal; previews how many roadmap stages that is. */
export function GoalForm({ initial, submitLabel = 'Build my plan', onSubmit, onCancel }: Props) {
  const [start, setStart] = useState(initial?.start ?? 400);
  const [goal, setGoal] = useState(initial?.goal ?? Math.min(MAX_RATING, (initial?.start ?? 400) + 600));
  const [busy, setBusy] = useState(false);
  const validGoal = goal > start;
  const stages = pathStages(start, goal);
  const goals = [200, 400, 600, 1000].map((d) => Math.min(MAX_RATING, Math.round((start + d) / 50) * 50)).filter((g, i, a) => g > start && a.indexOf(g) === i);

  return (
    <div className="goal-form">
      <div>
        <div className="field-label">Where are you now?</div>
        <div className="preset-grid">
          {LEVEL_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`preset ${start === p.rating ? 'on' : ''}`}
              onClick={() => {
                setStart(p.rating);
                if (goal <= p.rating) setGoal(Math.min(MAX_RATING, p.rating + 600));
              }}
            >
              <b>{p.label}</b>
              <span>{p.rating === MIN_RATING ? 'unrated' : `~${p.rating}`}</span>
              <span className="muted">{p.hint}</span>
            </button>
          ))}
        </div>
        <label className="field inline" style={{ marginTop: 10 }}>
          Or enter your rating (any site; rapid or blitz)
          <input
            type="number"
            min={MIN_RATING}
            max={MAX_RATING - 50}
            step={25}
            value={start}
            onChange={(e) => setStart(Math.max(MIN_RATING, Math.min(MAX_RATING - 50, Number(e.target.value) || MIN_RATING)))}
          />
        </label>
      </div>

      <div>
        <div className="field-label">Roughly where do you want to get to?</div>
        <div className="btn-row">
          {goals.map((g) => (
            <button key={g} type="button" className={`btn small ${goal === g ? 'primary' : ''}`} onClick={() => setGoal(g)}>
              {g}
            </button>
          ))}
          <input
            type="number"
            min={MIN_RATING + 50}
            max={MAX_RATING}
            step={50}
            value={goal}
            style={{ width: 110 }}
            aria-label="Goal rating"
            onChange={(e) => setGoal(Math.max(MIN_RATING + 50, Math.min(MAX_RATING, Number(e.target.value) || 0)))}
          />
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          {validGoal
            ? `${stages.length} stage${stages.length > 1 ? 's' : ''}: ${stages.map((s) => s.title).join(' → ')}`
            : 'Pick a goal above your current level.'}
          {goal >= MAX_RATING && ' (The curriculum currently goes up to about 2200.)'}
        </div>
      </div>

      <div className="btn-row">
        <button
          className="btn primary"
          disabled={!validGoal || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit(start, goal);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Target size={16} /> {submitLabel}
        </button>
        {onCancel && <button className="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
