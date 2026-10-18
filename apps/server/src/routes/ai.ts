import { GoogleGenAI } from '@google/genai';
import { Router } from 'express';
import { z } from 'zod';
import { CATEGORIES, TITLE_MAX } from '../../../../shared';
import { env } from '../lib/env';
import { ah } from '../lib/http';

/**
 * AI-assisted drafting. Produces suggestions only: the app always lands the
 * creator on an editable draft, and the funding goal is never suggested.
 * Without an API key (or if the model is unavailable) a clearly labelled demo
 * generator is used instead.
 */
export const ai = Router();

const Input = z.object({
  answers: z.object({
    about: z.string().max(3000).default(''),
    audience: z.string().max(1500).default(''),
    why: z.string().max(1500).default(''),
    evidence: z.string().max(1500).default(''),
  }),
  creatorName: z.string().max(80).optional(),
});

const Suggestion = z.object({
  title: z.string(),
  category: z.enum(CATEGORIES),
  summary: z.string(),
  creatorDescription: z.string(),
  headline: z.string(),
  intro: z.string(),
  sections: z.array(z.object({ heading: z.string(), paragraph: z.string() })),
  sourcesToAdd: z.array(z.object({ title: z.string(), why: z.string() })),
  actions: z.array(z.string()),
  adHeadline: z.string(),
  adDescription: z.string(),
  ctaText: z.string(),
  locations: z.array(z.string()),
  interests: z.array(z.string()),
});
export type Suggestion = z.infer<typeof Suggestion>;

const SYSTEM = `You help people draft campaigns for a community-funded message amplification platform. Backers pay to distribute a message to new audiences; it is not a donation platform.
Write from the creator's own answers. Be plain, specific and calm; no hype, no exclamation marks.
Rules:
- title: at most ${TITLE_MAX} characters; the start may be used as an ad headline.
- summary: one or two sentences, under 200 characters.
- Never invent statistics, quotes, names or URLs. If a claim needs evidence, list it in sourcesToAdd describing what kind of source the creator should attach.
- sections: 2-3 short sections that structure the story the creator told.
- adHeadline under 40 characters, adDescription under 125 characters, ctaText under 20 characters.
- locations and interests: only what the creator mentioned or clearly implied; otherwise empty.
- Do not suggest a funding goal.`;

let client: GoogleGenAI | null = null;
const responseSchema = z.toJSONSchema(Suggestion);

/** Asks Gemini for structured suggestions. Returns null if the model is unavailable or replies with an invalid shape. */
async function geminiSuggest(input: z.infer<typeof Input>): Promise<Suggestion | null> {
  if (!env.geminiKey) return null;
  client ??= new GoogleGenAI({ apiKey: env.geminiKey });
  const a = input.answers;
  const response = await client.models.generateContent({
    model: env.aiModel,
    contents: `Creator: ${input.creatorName || 'not given'}\nWhat the campaign is about: ${a.about}\nWho it should reach: ${a.audience}\nWhy it matters: ${a.why}\nEvidence they have: ${a.evidence}`,
    config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', responseJsonSchema: responseSchema, temperature: 0.4 },
  });
  const parsed = Suggestion.safeParse(JSON.parse(response.text ?? 'null'));
  return parsed.success ? clamp(parsed.data) : null;
}

ai.post(
  '/draft',
  ah(async (req, res) => {
    const input = Input.parse(req.body);
    try {
      const suggestion = await geminiSuggest(input);
      if (suggestion) return res.json({ demo: false, suggestion });
    } catch (e) {
      console.warn('AI draft failed, using demo generator:', (e as Error).message.slice(0, 200));
    }
    res.json({ demo: true, suggestion: demoSuggestion(input) });
  }),
);

function clamp(s: Suggestion): Suggestion {
  return {
    ...s,
    title: s.title.slice(0, TITLE_MAX),
    summary: s.summary.slice(0, 200),
    adHeadline: s.adHeadline.slice(0, 40),
    adDescription: s.adDescription.slice(0, 125),
    ctaText: s.ctaText.slice(0, 20),
  };
}

/** Whole-word keywords per category; the category with the most matches wins. */
const KEYWORDS: [RegExp, (typeof CATEGORIES)[number]][] = [
  [/\b(climate|trees?|rivers?|pollution|recycl\w*|compost|solar|green|wildlife|oceans?|beach(es)?)\b/gi, 'Environment'],
  [/\b(health|clinics?|hospitals?|mental|drinking water|food|nutrition|disease|doctors?)\b/gi, 'Health'],
  [/\b(schools?|students?|teachers?|library|libraries|education|learn\w*|literacy)\b/gi, 'Education'],
  [/\b(research|science|data|sensors?|study|studies|labs?)\b/gi, 'Science'],
  [/\b(tax\w*|wages?|jobs?|economy|economic|housing|rent|prices?)\b/gi, 'Economic Policy'],
  [/\b(laws?|bills?|council|votes?|voting|policy|transit|bus(es)?|zoning|city hall)\b/gi, 'Public Policy'],
  [/\b(art|arts|music|theatre|theater|murals?|culture|festivals?)\b/gi, 'Arts & Culture'],
  [/\b(business(es)?|shops?|stores?|startups?|merchants?|customers?|clients?|founders?|brand|products?|services|agency|agencies|software|apps?|websites?|saas)\b/gi, 'Business'],
  [/\b(neighbo\w+|community|shelters?|volunteers?|local)\b/gi, 'Community'],
];

const INTERESTS: Partial<Record<(typeof CATEGORIES)[number], string[]>> = {
  Environment: ['Environment', 'Sustainability'],
  Health: ['Health', 'Parenting'],
  Education: ['Education', 'Parenting'],
  Science: ['Science', 'Technology'],
  'Economic Policy': ['Personal finance', 'Local news'],
  'Public Policy': ['Local news', 'Civic engagement'],
  'Arts & Culture': ['Arts', 'Music'],
  Business: ['Small business', 'Technology'],
  Community: ['Volunteering', 'Local news'],
};

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Shortens at a word boundary (never mid-word) and drops trailing punctuation or joining words. */
function clip(s: string, max: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t.replace(/[,;:]$/, '');
  return t.slice(0, max + 1).replace(/\s+\S*$/, '').replace(/[\s,;:–-]+(and|or|but|so|to|of|the|a|an|for|with|in)?$/i, '').replace(/[,;:]$/, '');
}
/** A headline-sized version: drops parentheses, then prefers ending at a clause before cutting words. */
function headlineFrom(text: string, max: number) {
  const t = cap(text.replace(/\s*\([^)]*\)/g, '').replace(/^(i want to|we want to|i'd like to|this campaign is about|it's about)\s+/i, '').replace(/[.!?]$/, '').trim());
  if (t.length <= max) return t;
  const clause = t.split(/,\s|\s(?:and|so|because|but|which|who)\s/)[0];
  return clause.length >= 12 && clause.length <= max ? clause : clip(t, max);
}
/** Place names listed in parentheses, e.g. "in India (Delhi NCR, Pune, Mumbai)". */
function placesFrom(text: string) {
  const list = text.match(/\(([^)]+)\)/)?.[1];
  return list && list.includes(',') ? list.split(',').map((x) => x.trim()).filter((x) => /^[A-Z]/.test(x)).slice(0, 8) : [];
}

/** Deterministic, offline stand-in that restructures the creator's own words. */
export function demoSuggestion({ answers: a }: z.infer<typeof Input>): Suggestion {
  const all = `${a.about} ${a.audience} ${a.why} ${a.evidence}`;
  const scored = KEYWORDS.map(([re, cat]) => [cat, all.match(re)?.length ?? 0] as const).sort((x, y) => y[1] - x[1]);
  const category = scored[0][1] > 0 ? scored[0][0] : 'Other';
  const about = sentences(a.about);
  const lead = about[0] || 'A message worth hearing';
  const title = headlineFrom(lead, TITLE_MAX);
  // The summary explains the stakes: "why" if given, otherwise the rest of the description.
  const summary = clip(sentences(a.why)[0] || about[1] || lead, 200);
  return {
    title,
    category,
    summary,
    creatorDescription: '',
    headline: title,
    intro: a.about.trim(),
    sections: [
      a.why.trim() && { heading: 'Why this matters', paragraph: a.why.trim() },
      a.audience.trim() && { heading: 'Who needs to hear this', paragraph: a.audience.trim() },
      a.evidence.trim() && { heading: 'What the evidence says', paragraph: a.evidence.trim() },
    ].filter(Boolean) as Suggestion['sections'],
    sourcesToAdd: [
      { title: 'Primary source for your main claim', why: 'Readers and reviewers check claims against a source they can open.' },
      ...(a.evidence.trim() ? [{ title: 'Link to the evidence you mentioned', why: 'Attach the report, study or article you described.' }] : []),
    ],
    actions: ['Share this campaign with one person outside your usual circle', 'Read the sources and decide for yourself'],
    adHeadline: headlineFrom(lead, 40),
    adDescription: clip(summary, 125),
    ctaText: category === 'Business' ? 'Learn more' : category === 'Public Policy' ? 'Have your say' : 'Read the story',
    locations: placesFrom(a.audience),
    interests: INTERESTS[category] ?? [],
  };
}
