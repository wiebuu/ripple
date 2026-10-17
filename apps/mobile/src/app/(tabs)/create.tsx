import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_META, STEPS } from '@shared';
import { CampaignRow, RowSkeleton } from '@/components/campaign';
import { PatternScroll, PatternWindow, usePatternScroll } from '@/components/brand/PatternWindow';
import { TabHeader } from '@/components/TabHeader';
import { Banner, ErrorState, Icon, T, haptic, type IconName } from '@/components/ui';
import { useTabReselect } from '@/hooks/useTabReselect';
import { errorMessage } from '@/lib/api';
import { openEditor, startDraft } from '@/lib/create';
import { relTime } from '@/lib/format';
import { useMyCampaigns } from '@/lib/queries';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { PullArea, usePullRefresh } from '@/hooks/usePullRefresh';

/**
 * The two ways to start are a matched pair: `pattern` is the surface card with
 * green swirls, `inverse` flips it to a green card with ink swirls.
 */
function StartOption({ icon, title, body, meta, onPress, loading, look }: { icon: IconName; title: string; body: string; meta: string; onPress: () => void; loading?: boolean; look: 'pattern' | 'inverse' }) {
  const { c } = useTheme();
  const inv = look === 'inverse';
  const fg = inv ? c.onPrimary : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: !!loading }}
      disabled={loading}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({ padding: space.xl, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: inv ? c.primary : c.surface, borderWidth: 1, borderColor: c.primary, gap: space.md, opacity: pressed || loading ? 0.85 : 1 })}>
      <PatternWindow tone={inv ? 'ink' : 'accent'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: inv ? c.onPrimary : c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={24} color={inv ? c.primary : c.onPrimary} weight="duotone" />
        </View>
        <Icon name="arrow-forward" size={20} color={inv ? c.onPrimary : c.primary} />
      </View>
      <View style={{ gap: 4 }}>
        <T variant="heading" style={{ color: fg }}>
          {loading ? 'Setting up your draft…' : title}
        </T>
        <T style={{ color: inv ? c.onPrimary : c.textMuted, opacity: inv ? 0.85 : 1 }}>{body}</T>
      </View>
      <T variant="small" style={{ color: inv ? c.onPrimary : c.primary, opacity: inv ? 0.8 : 1 }}>
        {meta}
      </T>
    </Pressable>
  );
}

export default function CreateTab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const mine = useMyCampaigns();
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const page = usePatternScroll('y');
  const pull = usePullRefresh(mine.refetch, page.value);
  useTabReselect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
    pull.onRefresh();
  });

  const drafts = (mine.data?.items ?? []).filter((x) => x.status === 'DRAFT' || x.status === 'CHANGES_REQUESTED');

  const manual = async () => {
    setBusy(true);
    try {
      openEditor(await startDraft());
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

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
      <View>
        <TabHeader title="Start a campaign" flush />
        <T color="textMuted">Share a message you want more people to see. We review it, backers fund the reach, and you get a report of who it reached.</T>
      </View>

      <StartOption look="pattern" icon="create-outline" title="Create manually" body="A guided editor with tips at every step and a full preview before you submit." meta={`5 steps · ${STEPS.join(' → ')}`} onPress={manual} loading={busy} />
      <StartOption look="inverse" icon="mic-outline" title="Create with your voice" body="Answer four short questions out loud. AI turns your answers into a draft you can edit." meta="About 3 minutes · works with your keyboard’s dictation" onPress={() => router.push('/create/voice')} />

      <View style={{ gap: space.md }}>
        <T variant="heading">Your drafts</T>
        {mine.isPending ? (
          <RowSkeleton />
        ) : mine.isError ? (
          <ErrorState message={(mine.error as Error).message} onRetry={() => mine.refetch()} />
        ) : drafts.length === 0 ? (
          <T color="textMuted">No drafts yet. Drafts save automatically as you type, so you can stop and come back any time.</T>
        ) : (
          drafts.map((d) => (
            <View key={d.id} style={{ gap: space.sm }}>
              <CampaignRow
                c={d}
                meta={`${STATUS_META[d.status].label} · edited ${relTime(d.updatedAt)}`}
                onPress={() => openEditor(d.id)}
                right={<Icon name="chevron-forward" size={18} color={c.textSubtle} style={{ alignSelf: 'center' }} />}
              />
              {d.status === 'CHANGES_REQUESTED' && !!d.latestNote && <Banner tone="warning" icon="chatbubble-ellipses-outline" title="Reviewer asked for changes" body={d.latestNote} />}
            </View>
          ))
        )}
      </View>

      <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surfaceAlt, gap: space.sm }}>
        <T variant="smallStrong">Good to have ready</T>
        {['A clear message in one sentence', 'At least one source for your main claim', 'A strong cover photo you have rights to', 'Where your audience lives'].map((x) => (
          <View key={x} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Icon name="checkmark-circle-outline" size={16} color={c.primary} />
            <T variant="small">{x}</T>
          </View>
        ))}
      </View>
    </Animated.ScrollView>
    </PatternScroll>
    </PullArea>
    </View>
  );
}
