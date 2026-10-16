/**
 * End-to-end API smoke test against a running server (reseeds first is recommended).
 * Usage: API=http://localhost:4000 npm run smoke
 */
import { emptyDraft } from '../../../shared';

const API = process.env.API ?? 'http://localhost:4000';
let pass = 0;
let fail = 0;

async function call(method: string, path: string, token?: string, body?: unknown) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}
function check(name: string, ok: boolean, extra?: unknown) {
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}`, ok ? '' : JSON.stringify(extra));
}

(async () => {
  const list = await call('GET', '/campaigns');
  check('public list works without auth', list.status === 200 && list.json.items.length > 5, list.status);
  check('public list hides drafts and in-review', !list.json.items.some((c: any) => ['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED'].includes(c.status)));
  const search = await call('GET', '/campaigns?q=SHELTER');
  check('search is case-insensitive', search.json.items.some((c: any) => c.slug === 'winter-shelter-hours'), search.json.items.length);
  const cat = await call('GET', '/campaigns?category=Health');
  check('category filter', cat.json.items.every((c: any) => c.category === 'Health') && cat.json.items.length > 0);
  const none = await call('GET', '/campaigns?q=zzzznothing');
  check('no results returns empty list', none.json.items.length === 0);

  const shelter = await call('GET', '/campaigns/winter-shelter-hours');
  check('detail exposes only opted-in backer names, no amounts', shelter.json.publicBackers.length === 2 && shelter.json.publicBackers.every((b: any) => b.amount === undefined));
  check('detail hides moderation notes from public', shelter.json.reviewNotes.length === 0);

  const guest = (await call('POST', '/auth/guest')).json;
  const creator = (await call('POST', '/auth/demo', undefined, { as: 'creator' })).json;
  const reviewer = (await call('POST', '/auth/demo', undefined, { as: 'reviewer' })).json;

  const hidden = await call('GET', `/campaigns/fresh-produce-corner-stores`, guest.token);
  check('in-review campaign is 404 for others', hidden.status === 404);

  const q = await call('GET', '/review/queue', creator.token);
  check('review routes are reviewer-only', q.status === 403);

  // Create -> submit -> invalid -> fix -> submit -> approve -> fund
  const d = emptyDraft('Smoke Tester');
  d.basics.title = 'Smoke test campaign';
  const created = await call('POST', '/drafts', guest.token, { content: d });
  check('create draft', created.status === 201, created.json);
  const id = created.json.id;
  const bad = await call('POST', `/drafts/${id}/submit`, guest.token);
  check('submit rejects incomplete draft with step index', bad.status === 422 && bad.json.details.step === 0, bad.json);

  Object.assign(d.basics, { category: 'Community', summary: 'Testing.' });
  d.story.intro = 'An intro paragraph.';
  d.story.sources = [{ id: 's1', title: 'Source', url: 'https://example.org/x' }];
  d.visuals = { ...d.visuals, coverImage: 'https://example.org/a.jpg', adImages: ['https://example.org/a.jpg'], adHeadline: 'Hi', adDescription: 'Desc' };
  d.reach.locations = ['Somewhere'];
  d.goal = 300;
  d.acceptedRules = true;
  await call('PATCH', `/drafts/${id}`, guest.token, { content: d });
  const ok = await call('POST', `/drafts/${id}/submit`, guest.token);
  check('submit valid draft', ok.status === 200 && ok.json.status === 'SUBMITTED', ok.json);

  const other = await call('PATCH', `/drafts/${id}`, creator.token, { content: d });
  check("can't edit someone else's draft", other.status === 403);

  const early = await call('POST', '/contributions', guest.token, { campaignId: id, amount: 10 });
  check('cannot back before approval', early.status === 409);

  const illegal = await call('POST', `/review/campaigns/${id}/transition`, reviewer.token, { to: 'PROMOTING' });
  check('illegal lifecycle transition rejected', illegal.status === 409, illegal.json);

  const appr = await call('POST', `/review/campaigns/${id}/decision`, reviewer.token, { action: 'approve' });
  check('approve opens for funding', appr.json.status === 'FUNDING', appr.json);

  const k = await call('POST', '/contributions', guest.token, { campaignId: id, amount: 50, showName: false });
  check('server computes fees', k.json.platformFee === 4 && k.json.processingFee === 1.75 && k.json.total === 51.75, k.json);
  const declined = await call('POST', `/contributions/${k.json.id}/pay`, guest.token, { cardNumber: '4000 0000 0000 0002', expiry: '12/30', cvc: '123', name: 'T' });
  check('declined card -> FAILED, nothing raised', declined.json.contribution.status === 'FAILED' && declined.json.campaign.raised === 0, declined.json);

  const k2 = await call('POST', '/contributions', guest.token, { campaignId: id, amount: 300 });
  const paid = await call('POST', `/contributions/${k2.json.id}/pay`, guest.token, { cardNumber: '4242424242424242', expiry: '12/30', cvc: '123', name: 'T' });
  check('success -> raised updated', paid.json.contribution.status === 'SUCCEEDED' && paid.json.campaign.raised === 300, paid.json);
  check('reaching goal -> FUNDED, not PROMOTING', paid.json.campaign.status === 'FUNDED', paid.json.campaign.status);
  const again = await call('POST', `/contributions/${k2.json.id}/pay`, guest.token, { cardNumber: '4242424242424242', expiry: '12/30', cvc: '123', name: 'T' });
  check('cannot pay twice', again.status === 409);

  await call('POST', `/review/campaigns/${id}/transition`, reviewer.token, { to: 'DISTRIBUTION_PREP' });
  const blocked = await call('POST', `/review/campaigns/${id}/transition`, reviewer.token, { to: 'PROMOTING' });
  check('promotion blocked until readiness checklist done', blocked.status === 409, blocked.json);
  await call('POST', `/review/campaigns/${id}/readiness`, reviewer.token, { budgetApproved: true, adSetupReady: true });
  const prom = await call('POST', `/review/campaigns/${id}/transition`, reviewer.token, { to: 'PROMOTING' });
  check('promotion starts after readiness', prom.json.status === 'PROMOTING', prom.json);
  const done = await call('POST', `/review/campaigns/${id}/transition`, reviewer.token, { to: 'COMPLETED' });
  const rep = await call('GET', `/campaigns/${id}/report`);
  check('final report separates spend and measured metrics', done.json.status === 'COMPLETED' && rep.json.report.final && rep.json.report.adSpend <= rep.json.report.adBudget, rep.json);

  const notes = await call('GET', '/notifications', guest.token);
  const kinds = notes.json.items.map((n: any) => n.kind);
  check('creator notified through lifecycle', ['SUBMISSION', 'FUNDING', 'MILESTONE', 'PROMOTION', 'REPORT', 'CONTRIBUTION'].every((x) => kinds.includes(x)), kinds);

  const ai = await call('POST', '/ai/draft', guest.token, { answers: { about: 'We want the city to plant trees on hot streets.', audience: 'Residents', why: 'Heat is dangerous.', evidence: '' } });
  check('AI draft returns suggestion without a goal', ai.status === 200 && ai.json.suggestion.title && !('goal' in ai.json.suggestion), ai.json);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
