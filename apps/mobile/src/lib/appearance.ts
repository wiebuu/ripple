import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppearanceMode = 'system' | 'light' | 'dark';

/** The user's light/dark choice, saved on the device. "system" follows the phone setting. */
export const useAppearance = create<{ mode: AppearanceMode; setMode: (m: AppearanceMode) => void }>()(
  persist((set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }), { name: 'appearance', storage: createJSONStorage(() => AsyncStorage) }),
);
