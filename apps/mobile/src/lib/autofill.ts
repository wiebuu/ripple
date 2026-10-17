import { sampleVideo, AD_DESCRIPTION_MAX, AD_HEADLINE_MAX, CTA_MAX, SUMMARY_MAX, TITLE_MAX, type DraftContent, type Source } from '@shared';
import { askAi, type AiSuggestion, type VoiceAnswers } from './create';
import { uid } from './format';

/**
 * One-tap auto-fill for testing the editor: a campaign to find new clients
 * for Wiecodes (wiecodes.com), a software studio and template marketplace.
 *
 * The facts (portfolio, links, audience) come from wiecodes.com. When the AI
 * service is available its wording replaces the title, summary, story opening
 * and ad copy; otherwise this written copy is used. The funding goal and the
 * rules confirmation are never filled: the creator must set and confirm those.
 */

const photo = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
const PHOTOS = {
  laptop: '1498050108023-c5249f4df085',
  code: '1461749280684-dccba630e2f6',
  team: '1522071820081-009f0129c71c',
  workspace: '1517694712202-14dd9538aa97',
};

/** Answers describing the campaign, used for the AI request and the voice screen. */
export const WIECODES_ANSWERS: VoiceAnswers = {
  about:
    'Wiecodes (wiecodes.com) is a software development studio and premium template marketplace. We build, launch and scale websites, mobile apps and SaaS products for startups and small businesses. We want founders outside our network to find us and start a project.',
  audience: 'Startup founders, small business owners and product teams in India (Delhi NCR, Dehradun, Bengaluru, Mumbai, Pune) who are planning a website, app or SaaS product.',
  why: 'Most small businesses still lose customers to slow, outdated websites or apps that never launch, and agencies are slow and expensive. Wiecodes ships production-ready products faster by building on its own tested templates.',
  evidence:
    'Live portfolio on wiecodes.com: SRHU.online (student community platform), Vamur (e-commerce for handmade products), BA Hospitality (hotel booking platform); NoteNerds and Socio in progress; free React and Next.js templates on the marketplace.',
};

const SOURCES: Omit<Source, 'id'>[] = [
  { title: 'Wiecodes: projects and development services', url: 'https://wiecodes.com', publisher: 'Wiecodes' },
  { title: 'Wiecodes template marketplace', url: 'https://wiecodes.com/templates', publisher: 'Wiecodes' },
  { title: 'Wiecodes on LinkedIn', url: 'https://www.linkedin.com/company/108601036', publisher: 'LinkedIn' },
  { title: 'Wiecodes on Instagram', url: 'https://www.instagram.com/wie.codes', publisher: 'Instagram' },
];

type Copy = { title: string; summary: string; headline: string; intro: string; adHeadline: string; adDescription: string; ctaText: string; actions: string[] };

const WRITTEN: Copy = {
  title: 'Get your startup online with Wiecodes',
  summary: 'Wiecodes builds fast websites, apps and SaaS products for startups and small businesses, from first idea to launch. See what we have shipped and start your project.',
  headline: 'Great ideas deserve software that actually ships',
  intro:
    'Too many startups and small businesses lose months, and customers, waiting for a website or app that never quite launches. Wiecodes is a small software studio that builds, launches and scales digital products, and we want more founders to know there is a faster way.',
  adHeadline: 'Your startup’s app, built and shipped',
  adDescription: 'Wiecodes builds fast websites, apps and SaaS for startups and small businesses. See our live projects and start yours.',
  ctaText: 'Start your project',
  actions: ['Visit wiecodes.com and look at the live projects', 'Share this with a founder who needs a website or app', 'Start a project through “Contact for services” on wiecodes.com'],
};

/** Prefer the AI's wording when it is real (not the offline demo), trimmed to each field's limit. */
function copyFrom(ai: { demo: boolean; suggestion: AiSuggestion } | null): Copy {
  if (!ai || ai.demo) return WRITTEN;
  const s = ai.suggestion;
  const pick = (v: string | undefined, fallback: string, max?: number) => (v?.trim() ? (max ? v.trim().slice(0, max) : v.trim()) : fallback);
  return {
    title: pick(s.title, WRITTEN.title, TITLE_MAX),
    summary: pick(s.summary, WRITTEN.summary, SUMMARY_MAX),
    headline: pick(s.headline, WRITTEN.headline),
    intro: pick(s.intro, WRITTEN.intro),
    adHeadline: pick(s.adHeadline, WRITTEN.adHeadline, AD_HEADLINE_MAX),
    adDescription: pick(s.adDescription, WRITTEN.adDescription, AD_DESCRIPTION_MAX),
    ctaText: pick(s.ctaText, WRITTEN.ctaText, CTA_MAX),
    actions: s.actions?.filter(Boolean).length ? s.actions.filter(Boolean).slice(0, 6) : WRITTEN.actions,
  };
}

let pending: Promise<{ demo: boolean; suggestion: AiSuggestion } | null> | null = null;
/** One AI request per app session, shared by every step's button; a failure falls back to the written copy. */
function askOnce() {
  pending ??= askAi(WIECODES_ANSWERS).catch(() => {
    pending = null;
    return null;
  });
  return pending;
}

export type FillTarget = 0 | 1 | 2 | 3 | 'all';

/** Fills one editor step (0 Basics … 3 Reach), or every step, with the Wiecodes campaign. Returns whether real AI wrote the copy. */
export async function autofillWiecodes(update: (fn: (d: DraftContent) => DraftContent) => void, target: FillTarget) {
  const ai = await askOnce();
  const t = copyFrom(ai);
  const all = target === 'all';
  update((d) => {
    let x = d;
    if (all || target === 0) {
      x = { ...x, basics: { ...x.basics, title: t.title, summary: t.summary, category: 'Business', creatorName: 'Wiecodes', creatorType: 'Business', coverImage: photo(PHOTOS.laptop) } };
    }
    if (all || target === 1) {
      const sources = SOURCES.map((s) => ({ ...s, id: uid() }));
      x = {
        ...x,
        story: {
          headline: t.headline,
          intro: t.intro,
          blocks: [
            { id: uid(), type: 'heading', text: 'What Wiecodes builds' },
            {
              id: uid(),
              type: 'paragraph',
              text: 'Websites, online stores, booking platforms, community apps and SaaS dashboards, built with React, Next.js, React Native and Node.js. Every project starts from tested building blocks from our own template marketplace, so you get a production-ready product sooner.',
            },
            { id: uid(), type: 'image', uri: photo(PHOTOS.team), caption: 'From first sketch to launch, Wiecodes works alongside founders at every step.', credit: 'Photo: Unsplash' },
            { id: uid(), type: 'heading', text: 'Real projects, already live' },
            {
              id: uid(),
              type: 'paragraph',
              text: 'Recent work includes SRHU.online, a student community platform with voice rooms and a marketplace; Vamur, an online store for handmade products; and BA Hospitality, a hotel booking and management platform. NoteNerds and Socio are in progress.',
            },
            { id: uid(), type: 'stat', value: '6', label: 'products built or in progress, listed on wiecodes.com', sourceId: sources[0].id },
            { id: uid(), type: 'heading', text: 'Why we are advertising' },
            {
              id: uid(),
              type: 'paragraph',
              text: 'Word of mouth only reaches people who already know us. This campaign puts Wiecodes in front of founders and business owners outside our network who are planning their next website or app.',
            },
          ],
          sources,
          actions: t.actions,
        },
      };
    }
    if (all || target === 2) {
      x = {
        ...x,
        visuals: { ...x.visuals, coverImage: photo(PHOTOS.laptop), adImages: [photo(PHOTOS.code, 800), photo(PHOTOS.workspace, 800)], adVideo: sampleVideo('coding').url, adHeadline: t.adHeadline, adDescription: t.adDescription, ctaText: t.ctaText },
      };
    }
    if (all || target === 3) {
      x = {
        ...x,
        reach: {
          ...x.reach,
          locations: ['Delhi NCR', 'Dehradun', 'Bengaluru', 'Mumbai', 'Pune'],
          ageRange: [22, 45],
          interests: ['Small business', 'Students', 'Education'],
          platforms: ['linkedin', 'instagram', 'google_search', 'facebook'],
          channels: { social_feed: 50, search: 50 },
          durationDays: 30,
        },
        fundingDays: 30,
      };
    }
    return x;
  });
  return !!ai && !ai.demo;
}
