import * as Linking from 'expo-linking';
import { Share } from 'react-native';
import type { CampaignSummary } from '@shared';
import { toast } from './toast';

export async function shareCampaign(c: Pick<CampaignSummary, 'id' | 'title' | 'summary'>) {
  const url = Linking.createURL(`/campaign/${c.id}`);
  try {
    await Share.share({ message: `${c.title}\n\n${c.summary}\n\nHelp this message reach more people on Ripple: ${url}`, url, title: c.title });
  } catch {
    toast('Couldn’t open the share sheet', 'error');
  }
}
