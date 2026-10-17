import { router } from 'expo-router';
import { useRef } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DASHBOARD_TABS } from '@shared';
import { TabHeader } from '@/components/TabHeader';
import { Button, Card, Icon, IconButton, Pill, T, haptic, type IconName } from '@/components/ui';
import { useTabReselect } from '@/hooks/useTabReselect';
import { useBacked, useFollowing, useMyCampaigns, useSaved } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { radius, space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';
import { PatternScroll, PatternWindow, usePatternScroll } from '@/components/brand/PatternWindow';

export default function Profile() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const mine = useMyCampaigns();
  const backed = useBacked();
  const saved = useSaved();
  const following = useFollowing();
  const scroll = useRef<ScrollView>(null);
  const page = usePatternScroll('y');
  const pull = usePullRefresh(() => Promise.all([mine.refetch(), backed.refetch(), saved.refetch(), following.refetch()]), page.value);
  const refresh = pull.onRefresh;
  useTabReselect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
    refresh();
  });

  const guest = !user || user.isGuest;
  const counts = DASHBOARD_TABS.map((t) => ({ ...t, n: (mine.data?.items ?? []).filter((x) => t.statuses.includes(x.status)).length }));
  const needsAction = counts.find((t) => t.key === 'action')?.n ?? 0;
  const initials = (user?.name ?? 'G').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    {pull.indicator()}
    <PullArea pull={pull}>
    <PatternScroll axis="y" value={page.value}>
    <Animated.ScrollView
      ref={scroll}
      onScroll={page.onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.xl, paddingTop: 0, gap: space.xl, paddingBottom: space.huge }}
      refreshControl={pull.control()}>
      <TabHeader title="Profile" flush>
        <IconButton icon="ellipsis-horizontal" label="Menu: activity, settings, help and sign out" onPress={() => router.push('/menu')} style={{ marginRight: -space.sm }} />
      </TabHeader>

      <View style={{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: c.surface, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.lg, borderWidth: 1, borderColor: c.border }}>
        <PatternWindow />
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          {guest ? <Icon name="person-outline" size={24} color={c.primary} /> : <T variant="title" color="primary" style={{ fontSize: 20 }}>{initials}</T>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading">{guest ? 'Browsing as a guest' : user!.name}</T>
          <T variant="small" color="textMuted">
            {guest ? 'Sign in to keep your drafts and receipts' : user!.email}
          </T>
          {user?.role === 'REVIEWER' && <Pill label="Review team" tone="primary" />}
        </View>
      </View>
      {guest && <Button label="Sign in or create an account" icon="log-in-outline" onPress={() => router.push('/sign-in')} />}

      {user?.role === 'REVIEWER' && (
        <Card onPress={() => router.push('/review')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.infoSoft, borderColor: c.infoSoft }}>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Review queue</T>
            <T variant="small" color="textMuted">
              Approve campaigns, request changes, authorise distribution
            </T>
          </View>
          <T variant="smallStrong" color="info">
            Open
          </T>
        </Card>
      )}

      <CampaignJourney counts={counts} loading={mine.isPending} needsAction={needsAction} />

      <ActivityStrip
        items={[
          { label: 'Following', icon: 'eye-outline', n: following.data?.items.length, href: '/following' },
          { label: 'Backed', icon: 'hand-heart', n: backed.data?.items.length, href: '/backed' },
          { label: 'Saved', icon: 'bookmark-outline', n: saved.data?.items.length, href: '/saved' },
        ]}
      />
    </Animated.ScrollView>
    </PatternScroll>
    </PullArea>
    </View>
  );
}

/** Short labels so all six stages fit on one track. */
const STAGE_LABEL: Record<string, string> = { drafts: 'Drafts', review: 'In review', action: 'Needs action', funding: 'Funding', promoting: 'Live', completed: 'Done' };

/**
 * "My campaigns" as a journey: the six stages are nodes on one track, so you
 * can see where your campaigns are in the lifecycle at a glance. Tap a stage
 * to open that list.
 */
function CampaignJourney({ counts, loading, needsAction }: { counts: { key: string; label: string; n: number }[]; loading: boolean; needsAction: number }) {
  const { c } = useTheme();
  const total = counts.reduce((a, t) => a + t.n, 0);
  const NODE = 40;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T variant="heading" style={{ flex: 1 }}>
          My campaigns
        </T>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/my-campaigns')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <T variant="smallStrong" color="primary">
            {loading ? 'See all' : `All ${total}`}
          </T>
          <Icon name="chevron-forward" size={14} color={c.primary} />
        </Pressable>
      </View>
      <View style={{ paddingTop: space.xs, gap: space.md }}>
        <View style={{ flexDirection: 'row' }}>
          {/* The track runs behind the nodes, from the first centre to the last. */}
          <View style={{ position: 'absolute', top: NODE / 2 - 1, left: `${100 / 12}%`, right: `${100 / 12}%`, height: 2, borderRadius: 1, backgroundColor: c.track }} />
          {counts.map((t) => {
            const warn = t.key === 'action' && t.n > 0;
            const on = t.n > 0;
            // Filled green = campaigns at this stage; an outlined warning ring = needs you.
            const fill = warn ? c.warningSoft : on ? c.primary : c.surface;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                accessibilityLabel={`${t.label}: ${t.n}`}
                onPress={() => {
                  haptic.light();
                  router.push({ pathname: '/my-campaigns', params: { tab: t.key } });
                }}
                style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: fill === c.surface ? c.bg : fill, borderWidth: warn ? 2 : on ? 0 : 1.5, borderColor: warn ? c.warning : c.border }}>
                  <T variant="bodyStrong" style={{ color: warn ? c.warning : on ? c.onPrimary : c.textSubtle, fontVariant: ['tabular-nums'] }}>
                    {loading ? '–' : t.n}
                  </T>
                </View>
                <T variant="small" center numberOfLines={2} style={{ fontSize: 11, lineHeight: 14, color: warn ? c.warning : on ? c.text : c.textMuted }}>
                  {STAGE_LABEL[t.key] ?? t.label}
                </T>
              </Pressable>
            );
          })}
        </View>
        {needsAction > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.warningSoft }}>
            <Icon name="alert-circle-outline" size={16} color={c.warning} />
            <T variant="small" style={{ flex: 1, color: c.warning }}>
              {needsAction} campaign{needsAction > 1 ? 's need' : ' needs'} your attention.
            </T>
          </View>
        ) : (
          !loading &&
          total === 0 && (
            <T variant="small" color="textMuted" center>
              Nothing here yet. Your campaigns will move along this track.
            </T>
          )
        )}
      </View>
    </View>
  );
}

/** "Your activity" as a plain list: one hairline-separated row per collection, no box. */
function ActivityStrip({ items }: { items: { label: string; icon: IconName; n?: number; href: '/following' | '/backed' | '/saved' }[] }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <T variant="heading">Your activity</T>
      {items.map((it, i) => (
        <Pressable
          key={it.label}
          accessibilityRole="button"
          accessibilityLabel={`${it.label}: ${it.n ?? 0}`}
          onPress={() => {
            haptic.light();
            router.push(it.href);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, opacity: pressed ? 0.6 : 1 })}>
          <Icon name={it.icon} size={20} color={c.primary} weight="duotone" />
          <T variant="bodyStrong" style={{ flex: 1 }}>
            {it.label}
          </T>
          <T variant="bodyStrong" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
            {it.n ?? '–'}
          </T>
          <Icon name="chevron-forward" size={16} color={c.textSubtle} />
        </Pressable>
      ))}
    </View>
  );
}
