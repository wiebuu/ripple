import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { CHANNELS, DEFAULT_FUNDING_DAYS, FUNDING_DAY_OPTIONS, PLATFORMS, type PlatformKey, channelFactor, peoplePerHundred, type ChannelKey } from '@shared';
import { fonts, radius, space, useTheme } from '@/theme';
import { Banner, Card, Chip, Icon, IconButton, Pill, T, haptic, type IconName } from '../ui';
import { AdPreview } from './VisualsStep';
import { FieldError, Label, StepIntro, type StepProps } from './shared';

const LOCATION_SUGGESTIONS = ['United States', 'California', 'New York, NY', 'Texas', 'Chicago, IL', 'London, UK', 'Toronto, Canada'];
const INTERESTS = ['Local news', 'Parenting', 'Education', 'Environment', 'Public health', 'Volunteering', 'Small business', 'Transit', 'Arts', 'Science', 'Students', 'Housing'];
const DURATIONS = [7, 14, 21, 30, 45, 60, 90];
const NETWORKS = ['Meta', 'Google', 'More'] as const;
/** Logo and brand colour per app; `null` colour falls back to the text colour (monochrome brands). */
const PLATFORM_LOGOS: Record<PlatformKey, [IconName, string | null]> = {
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
const PLACEMENT_ICONS: Record<ChannelKey, IconName> = {
  social_feed: 'images-outline',
  stories: 'phone-portrait-outline',
  search: 'search-outline',
  news: 'document-text-outline',
  video: 'videocam-outline',
};

export function ReachStep({ d, update, errors }: StepProps) {
  const { c } = useTheme();
  const r = d.reach;
  const set = (p: Partial<typeof r>) => update((x) => ({ ...x, reach: { ...x.reach, ...p } }));
  const [loc, setLoc] = useState('');
  const [today] = useState(Date.now);
  const platforms = r.platforms ?? [];
  const togglePlatform = (k: PlatformKey) => set({ platforms: platforms.includes(k) ? platforms.filter((x) => x !== k) : [...platforms, k] });
  const setNetwork = (keys: PlatformKey[], on: boolean) => set({ platforms: on ? [...new Set([...platforms, ...keys])] : platforms.filter((x) => !keys.includes(x)) });
  const placements = CHANNELS.filter((ch) => r.channels[ch.key]).length;
  const fundingDays = d.fundingDays ?? DEFAULT_FUNDING_DAYS;

  const addLoc = (v: string) => {
    const t = v.trim();
    if (!t || r.locations.includes(t) || r.locations.length >= 20) return;
    set({ locations: [...r.locations, t] });
    setLoc('');
  };
  // Selected placements share the budget evenly; the review team sets the final split.
  const togglePlacement = (k: ChannelKey) => {
    const keys = CHANNELS.map((ch) => ch.key).filter((x) => (x === k ? !r.channels[x] : !!r.channels[x]));
    set({ channels: Object.fromEntries(keys.map((x) => [x, Math.floor(100 / keys.length)])) });
  };

  return (
    <View style={{ gap: space.xl }}>
      <StepIntro title="Who should it reach?" body="Tell us where and who your audience is. The review team uses this to set up the ads." />
      <Banner tone="info" icon="information-circle-outline" body="These are your preferences. The review team finalises targeting, bids and placements so they follow ad policies, and may adjust them." />

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Label text="Locations" required />
          <Pill label="You choose" tone="primary" />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            value={loc}
            onChangeText={setLoc}
            onSubmitEditing={() => addLoc(loc)}
            placeholder="City, region or country"
            placeholderTextColor={c.textSubtle}
            returnKeyType="done"
            accessibilityLabel="Add a location"
            style={{ flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: errors['reach.locations'] ? c.danger : c.border, backgroundColor: c.surface, paddingHorizontal: space.md, color: c.text, fontFamily: fonts.sans, fontSize: 16 }}
          />
          <IconButton icon="add-circle" label="Add location" tone="primary" size={28} onPress={() => addLoc(loc)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {r.locations.map((l) => (
            <Chip key={l} label={l} icon="close" selected onPress={() => set({ locations: r.locations.filter((x) => x !== l) })} />
          ))}
          {LOCATION_SUGGESTIONS.filter((l) => !r.locations.includes(l))
            .slice(0, 4)
            .map((l) => (
              <Chip key={l} label={l} icon="add" onPress={() => addLoc(l)} />
            ))}
        </View>
        <FieldError error={errors['reach.locations']} />
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Label text="Age range" required />
          <Pill label="Adults only" tone="neutral" />
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Stepper label="From" value={r.ageRange[0]} min={18} max={r.ageRange[1] - 1} onChange={(v) => set({ ageRange: [v, r.ageRange[1]] })} />
          <Stepper label="To" value={r.ageRange[1]} min={r.ageRange[0] + 1} max={65} suffix={r.ageRange[1] >= 65 ? '+' : ''} onChange={(v) => set({ ageRange: [r.ageRange[0], v] })} />
        </View>
        <FieldError error={errors['reach.ageRange']} />
      </View>

      <View style={{ gap: space.sm }}>
        <Label text="Interests" hint="Optional. We never target by health, religion, politics or other sensitive traits." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {INTERESTS.map((i) => {
            const on = r.interests.includes(i);
            return <Chip key={i} label={i} selected={on} onPress={() => set({ interests: on ? r.interests.filter((x) => x !== i) : [...r.interests, i].slice(0, 20) })} />;
          })}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <View style={{ gap: space.xs }}>
          <Label text="Apps to advertise on" required hint="Pick the apps where people should see your ads." />
        </View>
        {NETWORKS.map((net) => {
          const items = PLATFORMS.filter((p) => p.network === net);
          const all = items.every((p) => platforms.includes(p.key));
          return (
            <View key={net} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {net !== 'More' && <Icon name={net === 'Meta' ? 'logo-meta' : 'logo-google'} size={14} color={c.textMuted} />}
                <T variant="overline" color="textMuted" style={{ flex: 1 }}>
                  {net === 'More' ? 'More apps' : net}
                </T>
                <Pressable accessibilityRole="button" accessibilityLabel={`${all ? 'Clear' : 'Select all'} ${net}`} hitSlop={8} onPress={() => setNetwork(items.map((p) => p.key), !all)}>
                  <T variant="smallStrong" color="primary">
                    {all ? 'Clear' : 'Select all'}
                  </T>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {items.map((p) => (
                  <PlatformTile key={p.key} k={p.key} label={p.label} on={platforms.includes(p.key)} onPress={() => togglePlatform(p.key)} />
                ))}
              </View>
            </View>
          );
        })}
        <FieldError error={errors['reach.platforms']} />
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Label text="Ad formats" required />
          <Pill label="Finalised in review" tone="warning" />
        </View>
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: errors['reach.channels'] ? c.danger : c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
          {CHANNELS.map((ch, i) => (
            <PlacementRow key={ch.key} icon={PLACEMENT_ICONS[ch.key]} label={ch.label} note={ch.note} on={!!r.channels[ch.key]} first={i === 0} onPress={() => togglePlacement(ch.key)} />
          ))}
        </View>
        <T variant="small" color="textMuted">
          {placements} selected · budget is shared evenly
        </T>
        <FieldError error={errors['reach.channels']} />
      </View>

      <View style={{ gap: space.sm }}>
        <Label text="Campaign live for" required hint="How long people can back it once approved. A live countdown shows on your campaign." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {FUNDING_DAY_OPTIONS.map((n) => (
            <Chip key={n} label={`${n} days`} selected={fundingDays === n} onPress={() => update((x) => ({ ...x, fundingDays: n }))} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="time-outline" size={14} color={c.textMuted} />
          <T variant="small" color="textMuted">
            If approved today, backing closes {new Date(today + fundingDays * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </T>
        </View>
        <FieldError error={errors.fundingDays} />
      </View>

      <View style={{ gap: space.sm }}>
        <Label text="How long should ads run?" required hint="Starts after funding closes and the ads are approved." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {DURATIONS.map((n) => (
            <Chip key={n} label={`${n} days`} selected={r.durationDays === n} onPress={() => set({ durationDays: n })} />
          ))}
        </View>
        <FieldError error={errors['reach.durationDays']} />
      </View>

      <Card style={{ gap: space.md }}>
        <T variant="overline" color="primary">
          Audience preview
        </T>
        <T variant="subheading">
          Adults {r.ageRange[0]}–{r.ageRange[1]}
          {r.ageRange[1] >= 65 ? '+' : ''} in {r.locations.length ? r.locations.join(', ') : 'your chosen locations'}
          {r.interests.length ? `, interested in ${r.interests.slice(0, 3).join(', ').toLowerCase()}` : ''}.
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="people-outline" size={16} color={c.primary} />
          <T variant="small" color="textMuted">
            With this channel mix, ₹100 reaches about {peoplePerHundred(channelFactor(r.channels))} people (estimate). Actual reach depends on ad prices, targeting and delivery.
          </T>
        </View>
        <AdPreview d={d} placement="Feed" />
      </Card>
    </View>
  );
}

function Stepper({ label, value, min, max, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 4 }} accessibilityLabel={`${label} age ${value}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => value > min && onChange(value - 1)} hitSlop={6} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="remove" size={20} color={value > min ? c.text : c.textSubtle} />
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <T variant="small" color="textMuted">
          {label}
        </T>
        <T variant="bodyStrong">
          {value}
          {suffix}
        </T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => value < max && onChange(value + 1)} hitSlop={6} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="add" size={20} color={value < max ? c.text : c.textSubtle} />
      </Pressable>
    </View>
  );
}

function PlacementRow({ icon, label, note, on, first, onPress }: { icon: IconName; label: string; note: string; on: boolean; first: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderTopWidth: first ? 0 : 1, borderTopColor: c.border, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
      <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: on ? c.primarySoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={on ? c.primary : c.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{label}</T>
        <T variant="small" color="textMuted" numberOfLines={1}>
          {note}
        </T>
      </View>
      <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? c.primary : c.textSubtle} />
    </Pressable>
  );
}

function PlatformTile({ k, label, on, onPress }: { k: PlatformKey; label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const [logo, brand] = PLATFORM_LOGOS[k];
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({
        flexBasis: '31%',
        flexGrow: 1,
        maxWidth: '33%',
        height: 76,
        borderRadius: radius.md,
        borderWidth: on ? 1.5 : 1,
        borderColor: on ? c.primary : c.border,
        backgroundColor: on ? c.primarySoft : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 4,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Icon name={logo} size={24} color={brand ?? c.text} />
      <T variant="small" numberOfLines={1} style={{ fontSize: 12, color: on ? c.text : c.textMuted }}>
        {label}
      </T>
      {on && (
        <View style={{ position: 'absolute', top: 6, right: 6 }}>
          <Icon name="checkmark-circle" size={16} color={c.primary} />
        </View>
      )}
    </Pressable>
  );
}
