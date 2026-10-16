import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@shared';
import { API_URL } from './api';

type SessionState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  setSession: (token: string, user: User) => void;
  reset: () => void;
  /** Browsing needs no account. Actions that need an identity get a silent guest session. */
  ensureToken: () => Promise<string | null>;
};

let pending: Promise<string | null> | null = null;

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      hydrated: false,
      setSession: (token, user) => set({ token, user }),
      reset: () => set({ token: null, user: null }),
      ensureToken: async () => {
        const t = get().token;
        if (t) return t;
        pending ??= fetch(`${API_URL}/auth/guest`, { method: 'POST' })
          .then((r) => r.json())
          .then((j) => {
            set({ token: j.token, user: j.user });
            return j.token as string;
          })
          .catch(() => null)
          .finally(() => (pending = null));
        return pending;
      },
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);
