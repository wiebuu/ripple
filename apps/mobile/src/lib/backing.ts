import { create } from 'zustand';

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
    if (get().campaignId !== campaignId) set({ campaignId, amount: 500, showName: false, displayName: '' });
  },
  set: (p) => set(p),
}));

export type PayResult = { contribution: import('@shared').Contribution; campaign: import('@shared').CampaignSummary };
