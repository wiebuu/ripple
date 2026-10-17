import { Image } from 'expo-image';
import { Pressable, TextInput, View } from 'react-native';
import { CHANNELS, DEFAULT_FUNDING_DAYS, PLATFORMS, GOAL_MAX, GOAL_MIN, REACH_CONFIG, STEP_VALIDATORS, STEPS, channelFactor, estimateReach, feeBreakdown } from '@shared';
import { formatMoney, formatReach } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';
import { Banner, Card, Divider, Icon, T } from '../ui';
import { FieldError, Label, StepIntro, type StepProps } from './shared';

const RULES = [
  'My claims are supported by the sources I listed.',
  'I have the rights to every image and video I uploaded.',
  'I understand backers fund distribution, and funds are not paid to me.',
  'I agree to the community guidelines and that reviewers may request changes or decline.',
];

export function SubmitStep({ d, update, errors, onJump }: StepProps & { onJump: (step: number) => void }) {
  const { c } = useTheme();
  const factor = channelFactor(d.reach.channels);
  const goal = d.goal ?? 0;
  const f = feeBreakdown(goal);
  const stepIssues = STEP_VALIDATORS.slice(0, 4).map((fn) => Object.values(fn(d)));
  const cover = d.visuals.coverImage || d.basics.coverImage;

  const sec = { issues: stepIssues, onJump };

  return (
    <View style={{ gap: space.xl }}>
      <StepIntro title="Review & submit" body="Check everything, set your funding goal, and send it to our review team." />

      <Section {...sec} title="Basics" step={0}>
        {cover ? <Image source={cover} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md }} contentFit="cover" /> : null}
        <T variant="heading">{d.basics.title || 'Untitled campaign'}</T>
        <T variant="small" color="textMuted">
          {d.basics.category || 'No category'} · by {d.basics.creatorName || '—'} ({d.basics.creatorType})
        </T>
        {!!d.basics.summary && <T color="textMuted">{d.basics.summary}</T>}
      </Section>

      <Section {...sec} title={STEPS[1]} step={1}>
        <T variant="bodyStrong">{d.story.headline || d.basics.title || 'No headline'}</T>
        <T variant="small" color="textMuted">
          {d.story.blocks.length} sections · {d.story.sources.length} sources · {d.story.actions.filter(Boolean).length} reader actions
        </T>
        {d.story.sources.map((s, i) => (
          <T key={s.id} variant="small" numberOfLines={1}>
            {i + 1}. {s.title || 'Untitled'} <T variant="small" color="textSubtle">{s.url.replace(/^https?:\/\//, '')}</T>
          </T>
        ))}
      </Section>

      <Section {...sec} title="Visuals" step={2}>
        <T variant="small" color="textMuted">
          {d.visuals.adImages.length} ad image{d.visuals.adImages.length === 1 ? '' : 's'}
          {d.visuals.adVideo ? ' · 1 video' : ''} · button “{d.visuals.ctaText}”
        </T>
        <T variant="bodyStrong">{d.visuals.adHeadline || d.basics.title.slice(0, 40)}</T>
      </Section>

      <Section {...sec} title={STEPS[3]} step={3}>
        <T variant="small">
          Adults {d.reach.ageRange[0]}–{d.reach.ageRange[1]} in {d.reach.locations.join(', ') || '—'}
        </T>
        <T variant="small">
          On {PLATFORMS.filter((p) => d.reach.platforms?.includes(p.key))
            .map((p) => p.label)
            .join(', ') || 'no apps yet'}
        </T>
        <T variant="small" color="textMuted">
          {CHANNELS.filter((ch) => d.reach.channels[ch.key])
            .map((ch) => ch.label)
            .join(' · ') || 'No placements'}
        </T>
        <T variant="small" color="textMuted">
          Live for {d.fundingDays ?? DEFAULT_FUNDING_DAYS} days · ads run for {d.reach.durationDays} days after funding closes
        </T>
      </Section>

      <View style={{ gap: space.sm }}>
        <Label text="Funding goal" required hint={`How much backers should raise for distribution. Between ${formatMoney(GOAL_MIN)} and ${formatMoney(GOAL_MAX)}. Only you set this.`} />
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: radius.md, borderWidth: errors.goal ? 1.5 : 1, borderColor: errors.goal ? c.danger : c.border, backgroundColor: c.surface, paddingHorizontal: space.lg, gap: space.sm }}>
          <T variant="subheading" color="textMuted">
            ₹
          </T>
          <TextInput
            value={d.goal == null ? '' : String(d.goal)}
            onChangeText={(t) => {
              const n = t.replace(/[^0-9]/g, '');
              update((x) => ({ ...x, goal: n ? Number(n) : null }));
            }}
            keyboardType="number-pad"
            placeholder="e.g. 400000"
            placeholderTextColor={c.textSubtle}
            accessibilityLabel="Funding goal in rupees"
            style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 20, color: c.text }}
          />
        </View>
        <FieldError error={errors.goal} />
      </View>

      {goal > 0 && (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <T variant="title" color="primary">
              ≈ {formatReach(estimateReach(goal, factor))}
            </T>
            <T color="textMuted">people at goal (estimate)</T>
          </View>
          <Divider />
          <Row k="Spent on advertising" v={formatMoney(f.adBudget)} />
          <Row k={`Platform share (${Math.round(REACH_CONFIG.platformFeeRate * 100)}%) for review, setup, reporting`} v={formatMoney(f.platformFee)} />
          <Row k="Campaign live for" v={`${d.fundingDays ?? DEFAULT_FUNDING_DAYS} days after approval`} />
          <Row k="Ad flight" v={`${d.reach.durationDays} days`} />
          <T variant="small" color="textMuted">
            Backers pay card processing on top. Funds are held by the platform and spent only on approved ads; they are never paid to you. If the goal isn’t met, the team runs a
            smaller campaign or refunds backers.
          </T>
        </Card>
      )}

      <View style={{ gap: space.sm }}>
        <Label text="Campaign rules" required />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: d.acceptedRules }}
          onPress={() => update((x) => ({ ...x, acceptedRules: !x.acceptedRules }))}
          style={{ gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: errors.acceptedRules ? c.danger : d.acceptedRules ? c.primary : c.border, backgroundColor: c.surface }}>
          {RULES.map((r) => (
            <View key={r} style={{ flexDirection: 'row', gap: space.sm }}>
              <Icon name="ellipse" size={6} color={c.textMuted} style={{ marginTop: 8 }} />
              <T variant="small" style={{ flex: 1 }}>
                {r}
              </T>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: d.acceptedRules ? c.primary : c.textSubtle, backgroundColor: d.acceptedRules ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {d.acceptedRules && <Icon name="checkmark" size={16} color={c.onPrimary} />}
            </View>
            <T variant="bodyStrong" style={{ flex: 1 }}>
              I confirm all of the above
            </T>
          </View>
        </Pressable>
        <FieldError error={errors.acceptedRules} />
      </View>

      <Banner tone="info" icon="time-outline" body="After you submit, editing is paused while we review. Most reviews finish within 1–2 business days." />
    </View>
  );
}

function Section({ title, step, children, issues, onJump }: { title: string; step: number; children: React.ReactNode; issues: string[][]; onJump: (s: number) => void }) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: space.sm, borderColor: issues[step]?.length ? c.warning : c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T variant="overline" color="textMuted" style={{ flex: 1 }}>
          {title}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} onPress={() => onJump(step)} hitSlop={10}>
          <T variant="smallStrong" color="primary">
            Edit
          </T>
        </Pressable>
      </View>
      {children}
      {issues[step]?.map((m) => (
        <View key={m} style={{ flexDirection: 'row', gap: 6 }}>
          <Icon name="alert-circle" size={14} color={c.warning} style={{ marginTop: 2 }} />
          <T variant="small" color="warning" style={{ flex: 1 }}>
            {m}
          </T>
        </View>
      ))}
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <T variant="small" color="textMuted" style={{ flex: 1 }}>
        {k}
      </T>
      <T variant="smallStrong">{v}</T>
    </View>
  );
}
