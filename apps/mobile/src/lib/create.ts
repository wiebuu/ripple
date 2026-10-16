import { router } from 'expo-router';
import { CATEGORIES, emptyDraft, type Category, type DraftContent } from '@shared';
import { api } from './api';
import { useDrafts } from './draft';
import { queryClient } from './queries';
import { useSession } from './session';
import { uid } from './format';

export type AiSuggestion = {
  title: string;
  category: string;
  summary: string;
  creatorDescription: string;
  headline: string;
  intro: string;
  sections: { heading: string; paragraph: string }[];
  sourcesToAdd: { title: string; why: string }[];
  actions: string[];
  adHeadline: string;
  adDescription: string;
  ctaText: string;
  locations: string[];
  interests: string[];
};

export type VoiceAnswers = { about: string; audience: string; why: string; evidence: string };

/** Creates a draft on the server and opens the five-step editor on Basics. */
export async function startDraft(content?: DraftContent) {
  const user = useSession.getState().user;
  const c = content ?? emptyDraft(user && !user.isGuest ? user.name : '');
  const r = await api<{ id: string; updatedAt: string }>('/drafts', { body: { content: c } });
  const t = new Date(r.updatedAt).getTime();
  useDrafts.getState().put(r.id, { content: c, step: 0, updatedAt: t, syncedAt: t });
  queryClient.invalidateQueries({ queryKey: ['me', 'campaigns'] });
  return r.id;
}

export async function askAi(answers: VoiceAnswers) {
  const user = useSession.getState().user;
  return api<{ demo: boolean; suggestion: AiSuggestion }>('/ai/draft', { body: { answers, creatorName: user?.name } });
}

/**
 * Turns AI suggestions into editable draft content. Never sets the funding
 * goal; sources come back as placeholders the creator must complete with links.
 */
export function applySuggestion(base: DraftContent, s: AiSuggestion, fields: 'all' | 'basics' = 'all'): DraftContent {
  const category = (CATEGORIES as readonly string[]).includes(s.category) ? (s.category as Category) : base.basics.category;
  const next: DraftContent = {
    ...base,
    basics: { ...base.basics, title: s.title.slice(0, 60), summary: s.summary.slice(0, 200), category },
  };
  if (fields === 'basics') return next;
  return {
    ...next,
    story: {
      headline: s.headline,
      intro: s.intro,
      blocks: s.sections.flatMap((sec) => [
        { id: uid(), type: 'heading' as const, text: sec.heading },
        { id: uid(), type: 'paragraph' as const, text: sec.paragraph },
      ]),
      sources: s.sourcesToAdd.map((x) => ({ id: uid(), title: x.title, url: '' })),
      actions: s.actions.slice(0, 6),
    },
    visuals: { ...base.visuals, adHeadline: s.adHeadline.slice(0, 40), adDescription: s.adDescription.slice(0, 125), ctaText: s.ctaText.slice(0, 20) || 'Learn more' },
    reach: { ...base.reach, locations: s.locations.length ? s.locations : base.reach.locations, interests: s.interests.length ? s.interests : base.reach.interests },
    goal: base.goal,
  };
}

export const openEditor = (id: string, step?: number) => {
  if (step != null) useDrafts.getState().setStep(id, step);
  router.push({ pathname: '/create/[id]', params: { id } });
};
