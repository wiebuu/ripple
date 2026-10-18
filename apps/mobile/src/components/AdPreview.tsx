import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { View } from 'react-native';
import { PLATFORMS, type CampaignDetail, type DraftContent, type PlatformKey } from '@shared';
import { PLATFORM_LOGOS } from '@/lib/platforms';
import { radius, space, useTheme } from '@/theme';
import { CampaignVideo } from './CampaignVideo';
import { Chip, Icon, T, haptic } from './ui';

export type Placement = 'Feed' | 'Story' | 'Search';
export const PLACEMENTS: Placement[] = ['Feed', 'Story', 'Search'];

/** What an ad is made of, whether it comes from a draft or a published campaign. */
export type AdCreative = { image?: string; video?: string; headline: string; description: string; by: string; cta: string };

export function adFromDraft(d: DraftContent): AdCreative {
  const v = d.visuals;
  return {
    image: v.adImages[0] || v.coverImage || d.basics.coverImage,
    video: v.adVideo,
    headline: v.adHeadline || d.basics.title.slice(0, 40) || 'Your ad headline',
    description: v.adDescription || d.basics.summary || 'Your ad description appears here.',
    by: d.basics.creatorName || 'Your name',
    cta: v.ctaText || 'Learn more',
  };
}

export function adFromCampaign(d: CampaignDetail): AdCreative {
  const v = d.visuals;
  return {
    image: v.adImages[0] || v.coverImage || d.coverImage,
    video: v.adVideo,
    headline: v.adHeadline || d.title.slice(0, 40),
    description: v.adDescription || d.summary,
    by: d.creatorName,
    cta: v.ctaText || 'Learn more',
  };
}

/** Which placement each app shows ads in. */
const PLACEMENT_OF: Record<PlatformKey, Placement[]> = {
  facebook: ['Feed', 'Story'],
  instagram: ['Feed', 'Story'],
  google_search: ['Search'],
  youtube: ['Feed'],
  google_display: ['Feed'],
  tiktok: ['Story'],
  snapchat: ['Story'],
  x: ['Feed'],
  linkedin: ['Feed'],
  reddit: ['Feed'],
  pinterest: ['Feed'],
};

/** Which placement each budget channel buys. */
const CHANNEL_PLACEMENT: Record<string, Placement> = { social_feed: 'Feed', news: 'Feed', video: 'Feed', stories: 'Story', search: 'Search' };

/**
 * The campaign's ad as people outside the creator's network will see it, so
 * backers know what their money puts on screen. Only the placements the
 * campaign actually runs in are offered, with the apps for each.
 */
export function AdPreviewSection({ ad, platforms, channels }: { ad: AdCreative; platforms?: PlatformKey[]; channels?: Record<string, number> }) {
  const { c } = useTheme();
  const apps = platforms?.length ? platforms : null;
  // Chosen apps decide the placements; without them, the budget's channels do; failing both, show every placement.
  const fromChannels = Object.entries(channels ?? {}).filter(([, share]) => share > 0).map(([k]) => CHANNEL_PLACEMENT[k]);
  const placements = apps
    ? PLACEMENTS.filter((p) => apps.some((k) => PLACEMENT_OF[k].includes(p)))
    : fromChannels.length
      ? PLACEMENTS.filter((p) => fromChannels.includes(p))
      : PLACEMENTS;
  const [picked, setPicked] = useState<Placement>(placements[0] ?? 'Feed');
  const placement = placements.includes(picked) ? picked : placements[0];
  const shownOn = apps?.filter((k) => PLACEMENT_OF[k].includes(placement)) ?? [];

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <T variant="heading" style={{ fontSize: 18, lineHeight: 23 }}>
          The ad you’re backing
        </T>
        <T variant="small" color="textMuted">
          What people outside the creator’s network will see. Each app lays it out a little differently.
        </T>
      </View>
      {placements.length > 1 && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {placements.map((p) => (
            <Chip
              key={p}
              label={p}
              selected={placement === p}
              onPress={() => {
                haptic.light();
                setPicked(p);
              }}
            />
          ))}
        </View>
      )}
      <AdMock ad={ad} placement={placement} />
      {shownOn.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xs }}>
          <T variant="small" color="textMuted">
            Runs on
          </T>
          {shownOn.map((k) => {
            const [logo, brand] = PLATFORM_LOGOS[k];
            return (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={logo} size={14} color={brand ?? c.text} />
                <T variant="smallStrong">{PLATFORMS.find((p) => p.key === k)?.label}</T>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** A mock of the ad in one placement. Colours in Search mimic a results page, so they stay fixed. */
export function AdMock({ ad, placement }: { ad: AdCreative; placement: Placement }) {
  const { c } = useTheme();

  if (placement === 'Search')
    return (
      <View style={{ padding: space.lg, borderRadius: radius.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E3E3', gap: 4 }}>
        <T variant="small" style={{ color: '#202124' }}>
          <T variant="smallStrong" style={{ color: '#202124' }}>
            Sponsored
          </T>{' '}
          · ripple.example
        </T>
        <T style={{ color: '#1A0DAB', fontSize: 18 }} numberOfLines={1}>
          {ad.headline}
        </T>
        <T variant="small" style={{ color: '#4D5156' }} numberOfLines={2}>
          {ad.description}
        </T>
      </View>
    );

  if (placement === 'Story') return <StoryAd ad={ad} />;

  return (
    <View style={{ borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="smallStrong" color="primary">
            {ad.by.trim().charAt(0).toUpperCase()}
          </T>
        </View>
        <View>
          <T variant="smallStrong">{ad.by}</T>
          <T variant="small" color="textMuted">
            Sponsored
          </T>
        </View>
      </View>
      <T style={{ paddingHorizontal: space.md, paddingBottom: space.sm }} numberOfLines={2}>
        {ad.description}
      </T>
      <FeedMedia ad={ad} />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.md, backgroundColor: c.surfaceAlt }}>
        <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
          {ad.headline}
        </T>
        <View style={{ paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: c.border }}>
          <T variant="smallStrong">{ad.cta}</T>
        </View>
      </View>
    </View>
  );
}

/** The feed ad's media: a video ad plays on its own, muted and looping, like in a real feed. */
function FeedMedia({ ad }: { ad: AdCreative }) {
  const { c } = useTheme();
  if (ad.video) return <CampaignVideo uri={ad.video} style={{ aspectRatio: 1, borderRadius: 0 }} />;
  if (!ad.image)
    return (
      <View style={{ width: '100%', aspectRatio: 1, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <T color="textSubtle">No image yet</T>
      </View>
    );
  return <Image source={ad.image} style={{ width: '100%', aspectRatio: 1, backgroundColor: c.skeleton }} contentFit="cover" />;
}

/**
 * A full-screen story ad: progress bar and sponsor on top, the video (or image)
 * full-bleed, and a "swipe up" call to action at the bottom instead of a button.
 * Colours are fixed: story ads are always light text over media.
 */
function StoryAd({ ad }: { ad: AdCreative }) {
  return (
    <View style={{ alignSelf: 'center', width: 230, aspectRatio: 9 / 16, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#111' }}>
      {ad.video ? <CampaignVideo uri={ad.video} fill style={{ borderRadius: 0 }} /> : ad.image ? <Image source={ad.image} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
      {/* Shades top and bottom keep the white text readable over any media. */}
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 190 }} />

      <View style={{ padding: space.md, gap: space.sm }}>
        <View style={{ height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
          <View style={{ width: '40%', height: '100%', backgroundColor: '#fff' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <T variant="smallStrong" style={{ color: '#fff', fontSize: 12 }}>
              {ad.by.trim().charAt(0).toUpperCase()}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="smallStrong" style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
              {ad.by}
            </T>
            <T variant="small" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
              Sponsored
            </T>
          </View>
        </View>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md, paddingBottom: space.lg, gap: space.md }}>
        <T variant="subheading" style={{ color: '#fff', fontSize: 17, lineHeight: 22 }} numberOfLines={3}>
          {ad.headline}
        </T>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Icon name="chevron-up" size={18} color="#fff" />
          <T variant="smallStrong" style={{ color: '#fff', fontSize: 13 }}>
            {ad.cta}
          </T>
          <T variant="small" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
            Swipe up
          </T>
        </View>
      </View>
    </View>
  );
}
