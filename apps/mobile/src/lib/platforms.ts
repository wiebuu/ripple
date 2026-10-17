import type { PlatformKey } from '@shared';
import type { IconName } from '@/components/ui';

/** Logo and brand colour per app; `null` colour falls back to the text colour (monochrome brands). */
export const PLATFORM_LOGOS: Record<PlatformKey, [IconName, string | null]> = {
  facebook: ['logo-facebook', '#1877F2'],
  instagram: ['logo-instagram', '#E1306C'],
  google_search: ['logo-google', '#4285F4'],
  youtube: ['logo-youtube', '#FF0033'],
  google_display: ['logo-google', '#34A853'],
  tiktok: ['logo-tiktok', null],
  snapchat: ['logo-snapchat', '#F7C600'],
  x: ['logo-x', null],
  linkedin: ['logo-linkedin', '#0A66C2'],
  reddit: ['logo-reddit', '#FF4500'],
  pinterest: ['logo-pinterest', '#E60023'],
};
