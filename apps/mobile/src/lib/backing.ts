import { create } from 'zustand';
import { useSession } from './session';

/** The signed-in person's name, to prefill "Name to show"; guests have no real name yet. */
export function accountName() {
  const u = useSession.getState().user;
  return u && !u.isGuest ? u.name : '';
}

/** In-progress contribution choices, kept while the backer moves between steps. */
type BackingState = {
  campaignId: string | null;
  amount: number;
  showName: boolean;
  displayName: string;
  email: string;
  start: (campaignId: string) => void;
  set: (p: Partial<Omit<BackingState, 'start' | 'set'>>) => void;
};

export const useBacking = create<BackingState>((set, get) => ({
  campaignId: null,
  amount: 500,
  showName: false,
  displayName: '',
  email: '',
  start: (campaignId) => {
    if (get().campaignId !== campaignId) set({ campaignId, amount: 500, showName: false, displayName: accountName() });
  },
  set: (p) => set(p),
}));

export type PayResult = { contribution: import('@shared').Contribution; campaign: import('@shared').CampaignSummary };
