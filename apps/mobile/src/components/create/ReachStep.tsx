import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { CHANNELS, channelFactor, peoplePerHundred, type ChannelKey } from '@shared';
import { fonts, radius, space, useTheme } from '@/theme';
import { Banner, Card, Chip, Icon, IconButton, Pill, T, haptic } from '../ui';
import { AdPreview } from './VisualsStep';
import { FieldError, Label, StepIntro, type StepProps } from './shared';

const LOCATION_SUGGESTIONS = ['United States', 'California', 'New York, NY', 'Texas', 'Chicago, IL', 'London, UK', 'Toronto, Canada'];
const INTERESTS = ['Local news', 'Parenting', 'Education', 'Environment', 'Public health', 'Volunteering', 'Small business', 'Transit', 'Arts', 'Science', 'Students', 'Housing'];
const DURATIONS = [7, 14, 21, 30, 45, 60, 90];

export function ReachStep({ d, update, errors }: StepProps) {
  const { c } = useTheme();
  const r = d.reach;
  const set = (p: Partial<typeof r>) => update((x) => ({ ...x, reach: { ...x.reach, ...p } }));
  const [loc, setLoc] = useState('');
  const total = Object.values(r.channels).reduce((a, b) => a + (b ?? 0), 0);

  const addLoc = (v: string) => {
    const t = v.trim();
    if (!t || r.locations.includes(t) || r.locations.length >= 20) return;
    set({ locations: [...r.locations, t] });
    setLoc('');
  };
  const setChannel = (k: ChannelKey, v: number) => {
    haptic.light();
    const next = { ...r.channels, [k]: Math.max(0, Math.min(100, v)) };
    if (!next[k]) delete next[k];
    set({ channels: next });
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Label text="Channels & budget split" required />
          <Pill label="Finalised in review" tone="warning" />
        </View>
        {CHANNELS.map((ch) => {
          const v = r.channels[ch.key] ?? 0;
          const share = total ? Math.round((v / total) * 100) : 0;
          return (
            <Card key={ch.key} style={{ gap: space.sm, borderColor: v ? c.primary : c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{ch.label}</T>
                  <T variant="small" color="textMuted">
                    {ch.note}
                  </T>
                </View>
                {v ? <T variant="subheading" color="primary">{share}%</T> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <IconButton icon="remove-circle-outline" label={`Less ${ch.label}`} onPress={() => setChannel(ch.key, v - 10)} />
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.track }}>
                  <View style={{ width: `${share}%`, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                </View>
                <IconButton icon="add-circle-outline" label={`More ${ch.label}`} onPress={() => setChannel(ch.key, v + 10)} />
              </View>
            </Card>
          );
        })}
        <FieldError error={errors['reach.channels']} />
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
