import { Alert, Platform } from 'react-native';
import type { CampaignStatus } from '@shared';
import { api, errorMessage } from './api';
import { useDrafts } from './draft';
import { invalidateCampaign } from './queries';
import { toast } from './toast';

/** Only drafts can be deleted outright (the server keeps everything that was ever submitted). */
export const canDelete = (s: CampaignStatus) => s === 'DRAFT';
/** Submitted and live campaigns can be cancelled (or withdrawn) until funding closes; backers are refunded. */
export const canCancel = (s: CampaignStatus) => ['SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'FUNDING'].includes(s);
/** What the destructive action is called for a given status. */
export const cancelLabel = (s: CampaignStatus) => (s === 'SUBMITTED' ? 'Withdraw from review' : 'Cancel campaign');

/** Native confirm dialog with a destructive button; on web it just runs. */
export function confirmDestructive(title: string, body: string, cta: string, run: () => void) {
  if (Platform.OS === 'web') return run();
  Alert.alert(title, body, [
    { text: 'Keep', style: 'cancel' },
    { text: cta, style: 'destructive', onPress: run },
  ]);
}

export async function deleteDraft(id: string) {
  try {
    await api(`/drafts/${id}`, { method: 'DELETE' });
    useDrafts.getState().remove(id);
    invalidateCampaign(id);
    toast('Draft deleted');
    return true;
  } catch (e) {
    toast(errorMessage(e), 'error');
    return false;
  }
}

export async function cancelCampaign(id: string, raised: number, reason?: string) {
  try {
    await api(`/drafts/${id}/cancel`, { body: { reason: reason?.trim() || undefined } });
    invalidateCampaign(id);
    toast(raised > 0 ? 'Campaign cancelled. Backers are being refunded.' : 'Campaign cancelled');
    return true;
  } catch (e) {
    toast(errorMessage(e), 'error');
    return false;
  }
}
