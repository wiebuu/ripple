import { router } from 'expo-router';
import type { AppNotification } from '@shared';
import { api } from './api';
import { queryClient } from './queries';

type Openable = Pick<AppNotification, 'kind' | 'campaignId'> & Partial<Pick<AppNotification, 'id' | 'read' | 'mine'>>;

/**
 * Where a notification leads, shared by Activity, the live banner and push taps:
 * a report → the campaign's report; anything about your own campaign (approved,
 * changes requested, funded, ads live …) → Manage; a review decision without
 * ownership info (older notifications) → Manage too; otherwise the campaign
 * page. Notifications without a campaign open Activity. Marks it read.
 */
export function openNotification(n: Openable) {
  if (n.id && !n.read) api('/notifications/read', { body: { ids: [n.id] } }).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
  const id = n.campaignId;
  if (!id) return router.navigate('/activity');
  if (n.kind === 'REPORT') return router.push({ pathname: '/campaign/[id]/report', params: { id } });
  if (n.mine || n.kind === 'REVIEW' || n.kind === 'SUBMISSION') return router.push({ pathname: '/manage/[id]', params: { id } });
  router.push({ pathname: '/campaign/[id]', params: { id } });
}
