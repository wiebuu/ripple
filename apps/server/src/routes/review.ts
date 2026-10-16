import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { CAMPAIGN_STATUSES, validateAll, type DraftContent } from '../../../../shared';
import { requireRole } from '../lib/auth';
import { db } from '../lib/db';
import { ah, HttpError, notFound } from '../lib/http';
import { simulateDelivery, transition } from '../lib/lifecycle';
import { notify } from '../lib/notify';
import { columnsFromContent, contentOf, toReport, toSummary } from '../lib/serialize';

/** Internal reviewer tools. Every route is restricted to the REVIEWER role. */
export const review = Router();
review.use(requireRole('REVIEWER'));

review.get(
  '/queue',
  ah(async (_req, res) => {
    const rows = await db.campaign.findMany({ where: { status: { not: 'DRAFT' } }, orderBy: { updatedAt: 'desc' } });
    const revisions = await db.campaign.findMany({ where: { pendingContent: { not: Prisma.AnyNull } }, select: { id: true } });
    const rev = new Set(revisions.map((r) => r.id));
    res.json({ items: rows.map((c) => ({ ...toSummary(c), hasPendingRevision: rev.has(c.id), budgetApproved: c.budgetApproved, adSetupReady: c.adSetupReady })) });
  }),
);

review.get(
  '/campaigns/:id',
  ah(async (req, res) => {
    const c = await db.campaign.findUnique({
      where: { id: req.params.id },
      include: { decisions: { orderBy: { createdAt: 'desc' } }, report: true, feedback: true },
    });
    if (!c) throw notFound('Campaign');
    const content = contentOf(c);
    const tally = (q: string) =>
      ['NO', 'SOMEWHAT', 'YES'].map((a) => ({ answer: a, count: c.feedback.filter((f) => f.question === q && f.answer === a).length }));
    res.json({
      ...toSummary(c),
      content,
      pendingContent: c.pendingContent,
      validationErrors: validateAll(content),
      budgetApproved: c.budgetApproved,
      adSetupReady: c.adSetupReady,
      audit: c.decisions,
      report: toReport(c, c.report),
      feedback: { visuals: tally('VISUALS'), mindChanged: tally('MIND_CHANGED') },
    });
  }),
);

const decision = z.object({
  action: z.enum(['approve', 'request_changes', 'reject']),
  note: z.string().trim().max(1000).optional(),
});

review.post(
  '/campaigns/:id/decision',
  ah(async (req, res) => {
    const { action, note } = decision.parse(req.body);
    if (action !== 'approve' && !note) throw new HttpError(400, 'Add a note so the creator knows what to change');
    const actor = req.user!;
    if (action === 'approve') {
      await transition(req.params.id, 'APPROVED', actor, { action: 'APPROVED', note });
      // Approved campaigns open for backing immediately in this prototype.
      const c = await transition(req.params.id, 'FUNDING', actor, { note: 'Published and open for backing' });
      return res.json(toSummary(c));
    }
    const to = action === 'reject' ? 'REJECTED' : 'CHANGES_REQUESTED';
    const c = await transition(req.params.id, to, actor, { action: to, note });
    res.json(toSummary(c));
  }),
);

/** Distribution readiness checklist. Both must be true before PROMOTING. */
review.post(
  '/campaigns/:id/readiness',
  ah(async (req, res) => {
    const body = z.object({ budgetApproved: z.boolean().optional(), adSetupReady: z.boolean().optional() }).parse(req.body);
    const c = await db.campaign.update({ where: { id: req.params.id }, data: body });
    await db.reviewDecision.create({
      data: {
        campaignId: c.id, actorId: req.user!.id, actorName: req.user!.name, action: 'TRANSITION', fromStatus: c.status, toStatus: c.status,
        note: `Readiness updated: budget ${c.budgetApproved ? 'approved' : 'not approved'}, ad setup ${c.adSetupReady ? 'ready' : 'not ready'}`,
      },
    });
    res.json({ budgetApproved: c.budgetApproved, adSetupReady: c.adSetupReady });
  }),
);

review.post(
  '/campaigns/:id/transition',
  ah(async (req, res) => {
    const { to, note } = z.object({ to: z.enum(CAMPAIGN_STATUSES), note: z.string().max(1000).optional() }).parse(req.body);
    const c = await transition(req.params.id, to, req.user!, { note });
    res.json(toSummary(c));
  }),
);

review.post(
  '/campaigns/:id/simulate-delivery',
  ah(async (req, res) => {
    const c = await db.campaign.findUnique({ where: { id: req.params.id } });
    if (c?.status !== 'PROMOTING') throw new HttpError(409, 'Only promoting campaigns have delivery to simulate');
    await simulateDelivery(c.id, 0.25);
    res.json({ ok: true });
  }),
);

/** Approve or decline a creator's edits to a live campaign. */
review.post(
  '/campaigns/:id/revision',
  ah(async (req, res) => {
    const { approve, note } = z.object({ approve: z.boolean(), note: z.string().max(1000).optional() }).parse(req.body);
    const c = await db.campaign.findUnique({ where: { id: req.params.id } });
    if (!c?.pendingContent) throw new HttpError(409, 'No pending revision');
    const pending = c.pendingContent as unknown as DraftContent;
    // Funding goal can't be changed after publishing.
    pending.goal = c.goal;
    await db.campaign.update({
      where: { id: c.id },
      data: approve ? { content: pending as any, pendingContent: Prisma.DbNull, ...columnsFromContent(pending) } : { pendingContent: Prisma.DbNull },
    });
    await db.reviewDecision.create({
      data: { campaignId: c.id, actorId: req.user!.id, actorName: req.user!.name, action: 'EDIT', fromStatus: c.status, toStatus: c.status, note: note ?? (approve ? 'Revision approved and published' : 'Revision declined') },
    });
    await notify(c.ownerId, {
      kind: 'REVIEW', campaignId: c.id, title: approve ? 'Edits approved' : 'Edits not approved',
      body: approve ? `Your changes to "${c.title}" are now live. Ads will use the updated content.` : note ?? 'Your live campaign stays as it was.',
    });
    res.json({ ok: true });
  }),
);
