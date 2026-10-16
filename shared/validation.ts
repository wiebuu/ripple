/**
 * Step validation shared by the app (inline errors) and the server
 * (authoritative check on submit). Returns a map of field path -> message.
 */
import { CATEGORIES, type DraftContent } from './types';
import { REACH_CONFIG } from './reach';

export type Errors = Record<string, string>;

export const TITLE_MAX = 60;
export const SUMMARY_MAX = 200;
export const AD_HEADLINE_MAX = 40;
export const AD_DESCRIPTION_MAX = 125;
export const CTA_MAX = 20;
export const GOAL_MIN = 250;
export const GOAL_MAX = 100000;

export const STEPS = ['Basics', 'Story', 'Visuals', 'Reach', 'Submit'] as const;
export type StepKey = (typeof STEPS)[number];

export function isUrl(s: string) {
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(s.trim());
}

export function validateBasics(d: DraftContent): Errors {
  const e: Errors = {};
  const b = d.basics;
  if (!b.title.trim()) e['basics.title'] = 'Add a campaign title.';
  else if (b.title.length > TITLE_MAX) e['basics.title'] = `Keep the title under ${TITLE_MAX} characters.`;
  if (!b.category || !CATEGORIES.includes(b.category)) e['basics.category'] = 'Choose a category.';
  if (!b.creatorName.trim()) e['basics.creatorName'] = 'Add the name people will see as the creator.';
  if (b.summary.length > SUMMARY_MAX) e['basics.summary'] = `Keep the summary under ${SUMMARY_MAX} characters.`;
  return e;
}

export function validateStory(d: DraftContent): Errors {
  const e: Errors = {};
  const s = d.story;
  if (!s.intro.trim() && !s.blocks.some((b) => b.type === 'paragraph' && b.text.trim()))
    e['story.intro'] = 'Write an introduction or at least one paragraph.';
  if (s.sources.length === 0) e['story.sources'] = 'Add at least one supporting source so readers can check your claims.';
  s.sources.forEach((src, i) => {
    if (!src.title.trim()) e[`story.sources.${i}.title`] = 'Source needs a title.';
    if (!isUrl(src.url)) e[`story.sources.${i}.url`] = 'Enter a full link starting with https://';
  });
  s.blocks.forEach((b, i) => {
    if (b.type === 'stat' && (!b.value.trim() || !b.label.trim())) e[`story.blocks.${i}`] = 'Statistics need a value and a label.';
    if (b.type === 'image' && !b.uri) e[`story.blocks.${i}`] = 'Choose an image or remove this block.';
  });
  return e;
}

export function validateVisuals(d: DraftContent): Errors {
  const e: Errors = {};
  const v = d.visuals;
  if (!v.coverImage && !d.basics.coverImage) e['visuals.coverImage'] = 'Add a cover image. It is shown on every campaign card.';
  if (v.adImages.length === 0 && !v.adVideo) e['visuals.adImages'] = 'Add at least one advertising image or video.';
  if (v.adHeadline.length > AD_HEADLINE_MAX) e['visuals.adHeadline'] = `Ad headlines are cut off after ${AD_HEADLINE_MAX} characters.`;
  if (v.adDescription.length > AD_DESCRIPTION_MAX) e['visuals.adDescription'] = `Keep the description under ${AD_DESCRIPTION_MAX} characters.`;
  if (!v.ctaText.trim()) e['visuals.ctaText'] = 'Add a call-to-action.';
  else if (v.ctaText.length > CTA_MAX) e['visuals.ctaText'] = `Keep the call-to-action under ${CTA_MAX} characters.`;
  return e;
}

export function validateReach(d: DraftContent): Errors {
  const e: Errors = {};
  const r = d.reach;
  if (r.locations.length === 0) e['reach.locations'] = 'Choose at least one location.';
  const total = Object.values(r.channels).reduce((a, b) => a + (b ?? 0), 0);
  if (total === 0) e['reach.channels'] = 'Choose at least one distribution channel.';
  if (r.durationDays < 7 || r.durationDays > 90) e['reach.durationDays'] = 'Duration must be between 7 and 90 days.';
  if (r.ageRange[0] < 18) e['reach.ageRange'] = 'Advertising audiences must be 18 or older.';
  return e;
}

export function validateSubmit(d: DraftContent): Errors {
  const e: Errors = {};
  if (d.goal == null || Number.isNaN(d.goal)) e['goal'] = 'Set a funding goal.';
  else if (d.goal < GOAL_MIN) e['goal'] = `The minimum goal is $${GOAL_MIN}, enough for a meaningful test.`;
  else if (d.goal > GOAL_MAX) e['goal'] = `The maximum goal is $${GOAL_MAX.toLocaleString('en-US')}.`;
  if (!d.acceptedRules) e['acceptedRules'] = 'Confirm the campaign rules to submit.';
  return e;
}

export const STEP_VALIDATORS = [validateBasics, validateStory, validateVisuals, validateReach, validateSubmit];

export function validateAll(d: DraftContent) {
  return STEP_VALIDATORS.reduce<Errors>((acc, fn) => ({ ...acc, ...fn(d) }), {});
}

/** Index of first step with errors, or -1. */
export function firstInvalidStep(d: DraftContent) {
  return STEP_VALIDATORS.findIndex((fn) => Object.keys(fn(d)).length > 0);
}

export function validateContributionAmount(amount: number): string | null {
  if (!Number.isFinite(amount)) return 'Enter an amount.';
  if (amount < REACH_CONFIG.minContribution) return `The minimum contribution is $${REACH_CONFIG.minContribution}.`;
  if (amount > REACH_CONFIG.maxContribution) return `The maximum contribution is $${REACH_CONFIG.maxContribution.toLocaleString('en-US')}.`;
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) return 'Use whole cents.';
  return null;
}
