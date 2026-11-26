import { create } from 'zustand';
import { getSetting, setSetting } from '../db/db';
import { setSoundEnabled } from './sound';

export type BoardTheme = 'slate' | 'wood' | 'green' | 'ice';

interface Prefs {
  boardTheme: BoardTheme;
  sound: boolean;
  reviewDepth: number;
  showCoords: boolean;
  /** Daily training budget in minutes (20 / 40 / 60). */
  dailyMinutes: number;
}

interface SettingsState extends Prefs {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Prefs>) => void;
}

const DEFAULTS: Prefs = { boardTheme: 'slate', sound: true, reviewDepth: 14, showCoords: true, dailyMinutes: 40 };

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const saved = await getSetting<Partial<Prefs>>('prefs', DEFAULTS);
    const merged = { ...DEFAULTS, ...saved };
    setSoundEnabled(merged.sound);
    set({ ...merged, loaded: true });
  },
  update: (patch) => {
    set(patch);
    const { boardTheme, sound, reviewDepth, showCoords, dailyMinutes } = get();
    setSoundEnabled(sound);
    void setSetting('prefs', { boardTheme, sound, reviewDepth, showCoords, dailyMinutes });
  },
}));
