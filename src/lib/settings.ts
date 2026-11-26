import { create } from 'zustand';
import { getSetting, setSetting } from '../db/db';
import { setSoundEnabled } from './sound';
import { setEngineFlavor, type EngineFlavor } from '../engine/EngineService';

export type BoardTheme = 'slate' | 'wood' | 'green' | 'ice';
export type ReviewQuality = 'quick' | 'standard' | 'deep';

/** Nodes searched per position in Game Review. A fixed node budget gives even quality and predictable time. */
export const REVIEW_NODES: Record<ReviewQuality, number> = { quick: 150_000, standard: 400_000, deep: 1_200_000 };

interface Prefs {
  boardTheme: BoardTheme;
  sound: boolean;
  reviewQuality: ReviewQuality;
  engine: EngineFlavor;
  showCoords: boolean;
  /** Daily training budget in minutes (20 / 40 / 60). */
  dailyMinutes: number;
}

interface SettingsState extends Prefs {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Prefs>) => void;
}

const DEFAULTS: Prefs = { boardTheme: 'slate', sound: true, reviewQuality: 'standard', engine: 'fast', showCoords: true, dailyMinutes: 40 };

function apply(p: Prefs) {
  setSoundEnabled(p.sound);
  setEngineFlavor(p.engine);
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const saved = await getSetting<Partial<Prefs> & { reviewDepth?: number }>('prefs', DEFAULTS);
    // Migrate the old depth slider to a quality level.
    if (saved.reviewDepth !== undefined && !saved.reviewQuality) {
      saved.reviewQuality = saved.reviewDepth <= 12 ? 'quick' : saved.reviewDepth >= 17 ? 'deep' : 'standard';
    }
    const merged: Prefs = { ...DEFAULTS, ...saved };
    apply(merged);
    set({ ...merged, loaded: true });
  },
  update: (patch) => {
    set(patch);
    const { boardTheme, sound, reviewQuality, engine, showCoords, dailyMinutes } = get();
    const prefs: Prefs = { boardTheme, sound, reviewQuality, engine, showCoords, dailyMinutes };
    apply(prefs);
    void setSetting('prefs', prefs);
  },
}));
