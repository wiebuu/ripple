import type { NotificationKind } from '@shared';
import type { IconName } from '@/components/ui';
import type { Colors } from '@/theme';

/** Icon, colour and settings label for each notification category. */
export const KIND_META: Record<NotificationKind, { icon: IconName; tone: keyof Colors; label: string }> = {
  SUBMISSION: { icon: 'paper-plane-outline', tone: 'info', label: 'Submissions' },
  REVIEW: { icon: 'shield-checkmark-outline', tone: 'primary', label: 'Review decisions' },
  FUNDING: { icon: 'flag-outline', tone: 'primary', label: 'Funding status' },
  MILESTONE: { icon: 'trophy-outline', tone: 'accent', label: 'Funding milestones' },
  DEADLINE: { icon: 'alarm-outline', tone: 'warning', label: 'Deadlines' },
  CONTRIBUTION: { icon: 'card-outline', tone: 'success', label: 'Your contributions' },
  PROMOTION: { icon: 'radio-outline', tone: 'primary', label: 'Promotion & delivery' },
  REPORT: { icon: 'bar-chart-outline', tone: 'info', label: 'Reports' },
  UPDATE: { icon: 'chatbubble-ellipses-outline', tone: 'textMuted', label: 'Campaign updates & comments' },
  SECURITY: { icon: 'lock-closed-outline', tone: 'danger', label: 'Account security' },
};

