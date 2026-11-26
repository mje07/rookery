import { create } from 'zustand';
import { getSetting, setSetting } from '../db/db';
import { setSoundEnabled } from './sound';

export type BoardTheme = 'slate' | 'wood' | 'green' | 'ice';

interface SettingsState {
  boardTheme: BoardTheme;
  sound: boolean;
  reviewDepth: number;
  showCoords: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Pick<SettingsState, 'boardTheme' | 'sound' | 'reviewDepth' | 'showCoords'>>) => void;
}

const DEFAULTS = { boardTheme: 'slate' as BoardTheme, sound: true, reviewDepth: 14, showCoords: true };

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const saved = await getSetting('prefs', DEFAULTS);
    const merged = { ...DEFAULTS, ...saved };
    setSoundEnabled(merged.sound);
    set({ ...merged, loaded: true });
  },
  update: (patch) => {
    set(patch);
    const { boardTheme, sound, reviewDepth, showCoords } = get();
    setSoundEnabled(sound);
    void setSetting('prefs', { boardTheme, sound, reviewDepth, showCoords });
  },
}));
