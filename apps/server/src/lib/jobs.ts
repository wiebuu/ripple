import { formatMoney } from '../../../../shared';
import { db } from './db';
import { transition } from './lifecycle';
import { audienceOf, notifyMany } from './notify';

const DAY = 864e5;

/**
 * Time-based lifecycle work, run on an interval:
 * - funding periods that have ended close automatically (goal met → FUNDED handled on payment);
 * - followers, backers and the creator get one "deadline approaching" notice in the last 7 days.
 */
export async function runScheduledJobs() {
  const now = new Date();
  const open = await db.campaign.findMany({ where: { status: 'FUNDING', endsAt: { not: null } } });
  for (const c of open) {
    if (!c.endsAt) continue;
    if (c.endsAt <= now) {
      await transition(c.id, c.goal && c.raised >= c.goal ? 'FUNDED' : 'FUNDING_ENDED', null, { note: 'Funding period ended' }).catch(() => {});
      continue;
    }
    const daysLeft = Math.ceil((c.endsAt.getTime() - now.getTime()) / DAY);
    if (daysLeft <= 7) {
      const left = Math.max(0, (c.goal ?? 0) - c.raised);
      await notifyMany(await audienceOf(c.id), {
        kind: 'DEADLINE',
        title: `Funding closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        body: left > 0 ? `“${c.title}” is ${formatMoney(left)} from its goal.` : `“${c.title}” has reached its goal. Funding closes soon.`,
        campaignId: c.id,
        dedupeKey: `${c.id}:deadline`,
      });
    }
  }
}

export function startScheduler(everyMs = 10 * 60 * 1000) {
  const run = () => runScheduledJobs().catch((e) => console.error('[jobs]', e.message));
  setTimeout(run, 5_000);
  return setInterval(run, everyMs);
}
