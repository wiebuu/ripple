import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DraftContent } from '@shared';
import { api, errorMessage } from './api';
import { queryClient, useDraft } from './queries';

/**
 * Local-first draft store. Every edit is persisted on the device immediately
 * and synced to the server after a short pause, so drafts survive app restarts
 * and flaky connections.
 */
export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type Entry = {
  content: DraftContent;
  step: number;
  updatedAt: number;
  syncedAt: number | null;
  /** Live campaigns: edits are stored as a revision awaiting review. */
  revision?: boolean;
};

type DraftState = {
  entries: Record<string, Entry>;
  saveState: Record<string, SaveState>;
  saveError: Record<string, string | undefined>;
  put: (id: string, e: Entry) => void;
  patch: (id: string, content: DraftContent) => void;
  setStep: (id: string, step: number) => void;
  remove: (id: string) => void;
};

export const useDrafts = create<DraftState>()(
  persist(
    (set) => ({
      entries: {},
      saveState: {},
      saveError: {},
      put: (id, e) => set((s) => ({ entries: { ...s.entries, [id]: e } })),
      patch: (id, content) =>
        set((s) => ({
          entries: { ...s.entries, [id]: { ...s.entries[id], content, updatedAt: Date.now() } },
          saveState: { ...s.saveState, [id]: 'pending' },
        })),
      setStep: (id, step) => set((s) => ({ entries: { ...s.entries, [id]: { ...s.entries[id], step } } })),
      remove: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.entries;
          return { entries: rest };
        }),
    }),
    { name: 'drafts', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ entries: s.entries }) },
  ),
);

const timers: Record<string, ReturnType<typeof setTimeout>> = {};

export async function syncDraft(id: string) {
  clearTimeout(timers[id]);
  const entry = useDrafts.getState().entries[id];
  if (!entry) return;
  useDrafts.setState((s) => ({ saveState: { ...s.saveState, [id]: 'saving' } }));
  try {
    const r = await api<{ pendingRevision?: boolean }>(`/drafts/${id}`, { method: 'PATCH', body: { content: entry.content } });
    useDrafts.setState((s) => ({
      entries: { ...s.entries, [id]: { ...s.entries[id], syncedAt: Date.now(), revision: !!r.pendingRevision } },
      saveState: { ...s.saveState, [id]: 'saved' },
      saveError: { ...s.saveError, [id]: undefined },
    }));
    queryClient.invalidateQueries({ queryKey: ['me', 'campaigns'] });
    return true;
  } catch (e) {
    useDrafts.setState((s) => ({ saveState: { ...s.saveState, [id]: 'error' }, saveError: { ...s.saveError, [id]: errorMessage(e) } }));
    return false;
  }
}

/** Editor binding for one draft. */
export function useDraftEditor(id: string) {
  const entry = useDrafts((s) => s.entries[id]);
  const saveState = useDrafts((s) => s.saveState[id] ?? 'idle');
  const saveError = useDrafts((s) => s.saveError[id]);
  const remote = useDraft(id);

  // Adopt the server copy unless the device has newer unsynced edits.
  useEffect(() => {
    const d = remote.data;
    if (!d) return;
    const local = useDrafts.getState().entries[id];
    const serverTime = new Date(d.updatedAt).getTime();
    if (!local || (local.syncedAt && local.updatedAt <= local.syncedAt && serverTime > local.syncedAt) || !local.content) {
      useDrafts.getState().put(id, { content: d.content, step: local?.step ?? 0, updatedAt: serverTime, syncedAt: serverTime });
    }
  }, [remote.data, id]);

  const update = (fn: (c: DraftContent) => DraftContent) => {
    const cur = useDrafts.getState().entries[id];
    if (!cur) return;
    useDrafts.getState().patch(id, fn(cur.content));
    clearTimeout(timers[id]);
    timers[id] = setTimeout(() => syncDraft(id), 900);
  };

  return {
    content: entry?.content,
    step: entry?.step ?? 0,
    setStep: (n: number) => useDrafts.getState().setStep(id, n),
    update,
    saveState,
    saveError,
    savedAt: entry?.syncedAt ?? null,
    saveNow: () => syncDraft(id),
    remote,
    status: remote.data?.status,
    reviewNote: remote.data?.latestReviewNote ?? null,
  };
}
