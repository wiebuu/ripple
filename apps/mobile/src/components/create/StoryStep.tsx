import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { Source, StoryBlock } from '@shared';
import { uid } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';
import { Field } from '../Field';
import { StoryView } from '../Story';
import { Button, Card, Chip, Icon, IconButton, T, haptic, type IconName } from '../ui';
import { ImageSlot } from './ImageSlot';
import { FieldError, Label, StepIntro, Tip, type StepProps } from './shared';

const BLOCK_TYPES: { type: StoryBlock['type']; label: string; icon: IconName }[] = [
  { type: 'heading', label: 'Heading', icon: 'text-outline' },
  { type: 'paragraph', label: 'Paragraph', icon: 'reorder-four-outline' },
  { type: 'image', label: 'Image', icon: 'image-outline' },
  { type: 'stat', label: 'Statistic', icon: 'stats-chart-outline' },
  { type: 'quote', label: 'Quote', icon: 'chatbox-ellipses-outline' },
];

const newBlock = (type: StoryBlock['type']): StoryBlock => {
  const id = uid();
  switch (type) {
    case 'heading':
      return { id, type, text: '' };
    case 'paragraph':
      return { id, type, text: '' };
    case 'image':
      return { id, type, uri: '', caption: '', credit: '' };
    case 'stat':
      return { id, type, value: '', label: '' };
    case 'quote':
      return { id, type, text: '', attribution: '' };
  }
};

export function StoryStep({ d, update, errors }: StepProps) {
  const { c } = useTheme();
  const s = d.story;
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const setStory = (p: Partial<typeof s>) => update((x) => ({ ...x, story: { ...x.story, ...p } }));
  const setBlocks = (fn: (b: StoryBlock[]) => StoryBlock[]) => update((x) => ({ ...x, story: { ...x.story, blocks: fn(x.story.blocks) } }));
  const setBlock = (id: string, p: Partial<StoryBlock>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...p } as StoryBlock) : b)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const setSources = (fn: (x: Source[]) => Source[]) => update((x) => ({ ...x, story: { ...x.story, sources: fn(x.story.sources) } }));

  return (
    <View style={{ gap: space.xl }}>
      <StepIntro title="Tell the story" body="Write it like a short article. Explain what’s happening, why it matters, and what evidence supports it." />

      <View style={{ flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: c.surfaceAlt }} accessibilityRole="tablist">
        {(['edit', 'preview'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => {
              haptic.light();
              setMode(m);
            }}
            style={{ flex: 1, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? c.surface : 'transparent' }}>
            <T variant="smallStrong" color={mode === m ? 'text' : 'textMuted'}>
              {m === 'edit' ? 'Write' : 'Live preview'}
            </T>
          </Pressable>
        ))}
      </View>

      {mode === 'preview' ? (
        <Card>
          <StoryView story={s} />
        </Card>
      ) : (
        <>
          <Field label="Headline" value={s.headline} onChangeText={(t) => setStory({ headline: t })} max={160} placeholder="The coldest hour of the night is the hour we close" helper="Shown at the top of your story. Defaults to your title." />
          <Field
            label="Introduction"
            required
            value={s.intro}
            onChangeText={(t) => setStory({ intro: t })}
            multiline
            max={2000}
            softMax
            placeholder="Two or three sentences that set the scene."
            error={errors['story.intro']}
          />

          <View style={{ gap: space.md }}>
            <Label text="Story sections" hint="Headings, paragraphs, photos, statistics and quotes, in reading order." />
            {s.blocks.map((b, i) => {
              const kind = BLOCK_TYPES.find((t) => t.type === b.type)!;
              return (
                // Flat sections split by hairlines, not cards, so the story reads like one document.
                <View key={b.id} style={{ gap: space.sm, paddingTop: i ? space.lg : 0, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name={kind.icon} size={14} color={c.textMuted} />
                    <T variant="small" color="textMuted" style={{ flex: 1 }}>
                      {kind.label}
                    </T>
                    <Tool icon="arrow-up" label={`Move ${kind.label.toLowerCase()} up`} disabled={i === 0} onPress={() => move(i, -1)} />
                    <Tool icon="arrow-down" label={`Move ${kind.label.toLowerCase()} down`} disabled={i === s.blocks.length - 1} onPress={() => move(i, 1)} />
                    <Tool icon="trash-outline" label={`Delete ${kind.label.toLowerCase()}`} onPress={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))} />
                  </View>
                  <BlockEditor b={b} sources={s.sources} category={d.basics.category} onChange={(p) => setBlock(b.id, p)} />
                  <FieldError error={errors[`story.blocks.${i}`]} />
                </View>
              );
            })}
            <View style={{ gap: space.sm, paddingTop: space.sm }}>
              <T variant="small" color="textMuted">
                Add a section
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {BLOCK_TYPES.map((t) => (
                  <Chip key={t.type} label={t.label} icon={t.icon} onPress={() => setBlocks((bs) => [...bs, newBlock(t.type)])} />
                ))}
              </View>
            </View>
          </View>

          <View style={{ gap: space.md }}>
            <Label text="Sources" required hint="Readers see these on your campaign page. Link to the reports, articles or data behind your claims." />
            {s.sources.map((src, i) => (
              <View key={src.id} style={{ gap: space.md, paddingTop: i ? space.lg : 0, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="link-outline" size={14} color={c.textMuted} />
                  <T variant="small" color="textMuted" style={{ flex: 1 }}>
                    Source {i + 1}
                  </T>
                  <Tool icon="trash-outline" label={`Remove source ${i + 1}`} onPress={() => setSources((x) => x.filter((y) => y.id !== src.id))} />
                </View>
                <Field label="Title" required value={src.title} onChangeText={(t) => setSources((x) => x.map((y) => (y.id === src.id ? { ...y, title: t } : y)))} placeholder="e.g. Lead in drinking water: basic information" error={errors[`story.sources.${i}.title`]} />
                <Field label="Link" required value={src.url} onChangeText={(t) => setSources((x) => x.map((y) => (y.id === src.id ? { ...y, url: t.trim() } : y)))} placeholder="https://" keyboardType="url" autoCapitalize="none" autoCorrect={false} error={errors[`story.sources.${i}.url`]} />
                <Field label="Publisher" value={src.publisher ?? ''} onChangeText={(t) => setSources((x) => x.map((y) => (y.id === src.id ? { ...y, publisher: t } : y)))} placeholder="e.g. US EPA" />
              </View>
            ))}
            <FieldError error={errors['story.sources']} />
            <Button label="Add a source" icon="add" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => setSources((x) => [...x, { id: uid(), title: '', url: '' }])} disabled={s.sources.length >= 20} />
          </View>

          <View style={{ gap: space.md }}>
            <Label text="What should readers do?" hint="Up to 6 simple actions, shown at the end of your story." />
            {s.actions.map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <TextInput
                  value={a}
                  onChangeText={(t) => setStory({ actions: s.actions.map((x, j) => (j === i ? t : x)) })}
                  placeholder="e.g. Email your council member before the vote"
                  placeholderTextColor={c.textSubtle}
                  accessibilityLabel={`Action ${i + 1}`}
                  maxLength={160}
                  style={{ flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: space.md, color: c.text, fontFamily: fonts.sans, fontSize: 16 }}
                />
                <IconButton icon="close" label={`Remove action ${i + 1}`} size={18} onPress={() => setStory({ actions: s.actions.filter((_, j) => j !== i) })} />
              </View>
            ))}
            {s.actions.length < 6 && <Button label="Add an action" icon="add" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => setStory({ actions: [...s.actions, ''] })} />}
          </View>

          <Tip>Every factual claim should point to a source. Reviewers check claims against the links you add, and readers can open them too.</Tip>
        </>
      )}
    </View>
  );
}

function BlockEditor({ b, sources, category, onChange }: { b: StoryBlock; sources: Source[]; category: string; onChange: (p: Partial<StoryBlock>) => void }) {
  switch (b.type) {
    case 'heading':
      return <Field label="Heading" hideLabel required value={b.text} onChangeText={(t) => onChange({ text: t })} max={160} placeholder="e.g. Why it matters" style={{ fontFamily: fonts.sansSemibold, fontSize: 18 }} />;
    case 'paragraph':
      return <RichField value={b.text} onChange={(t) => onChange({ text: t })} />;
    case 'image':
      return (
        <View style={{ gap: space.md }}>
          <ImageSlot uri={b.uri || undefined} category={category} aspect={3 / 2} onChange={(u) => onChange({ uri: u ?? '' })} />
          <Field label="Caption" value={b.caption ?? ''} onChangeText={(t) => onChange({ caption: t })} max={300} softMax placeholder="What does this photo show?" />
          <Field label="Image credit" value={b.credit ?? ''} onChangeText={(t) => onChange({ credit: t })} max={120} placeholder="Photographer or source" />
        </View>
      );
    case 'stat':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Number" required value={b.value} onChangeText={(t) => onChange({ value: t })} max={30} placeholder="e.g. 41 or 68%" />
          <Field label="What it measures" required value={b.label} onChangeText={(t) => onChange({ label: t })} max={160} placeholder="e.g. freeze-warning mornings last winter" />
          <View style={{ gap: space.sm }}>
            <Label text="Supporting source" hint={sources.length ? undefined : 'Add a source below to link it here.'} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {sources.map((s, i) => (
                <Chip key={s.id} label={`${i + 1}. ${s.title || 'Untitled'}`} selected={b.sourceId === s.id} onPress={() => onChange({ sourceId: b.sourceId === s.id ? undefined : s.id })} />
              ))}
            </View>
          </View>
        </View>
      );
    case 'quote':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Quote" hideLabel required value={b.text} onChangeText={(t) => onChange({ text: t })} multiline max={600} softMax />
          <Field label="Who said it" value={b.attribution ?? ''} onChangeText={(t) => onChange({ attribution: t })} max={120} placeholder="e.g. Volunteer coordinator" />
        </View>
      );
  }
}

/** Paragraph input with a minimal formatting toolbar (bold, italic, link). */
function RichField({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const { c } = useTheme();
  const [sel, setSel] = useState({ start: value.length, end: value.length });
  const wrap = (before: string, after: string, placeholder: string) => {
    haptic.light();
    const { start, end } = sel;
    const inner = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + inner + after + value.slice(end));
  };
  const tools: { icon: IconName; label: string; run: () => void }[] = [
    { icon: 'text', label: 'Bold', run: () => wrap('**', '**', 'bold text') },
    { icon: 'remove-outline', label: 'Italic', run: () => wrap('_', '_', 'italic text') },
    { icon: 'link-outline', label: 'Link', run: () => wrap('[', '](https://)', 'link text') },
  ];
  return (
    <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
        multiline
        maxLength={5000}
        placeholder="Write a paragraph…"
        placeholderTextColor={c.textSubtle}
        accessibilityLabel="Paragraph text"
        style={{ minHeight: 120, padding: space.md, paddingBottom: space.sm, color: c.text, fontFamily: fonts.sans, fontSize: 16, lineHeight: 25, textAlignVertical: 'top' }}
      />
      {/* A slim formatting row under the text, in quiet text rather than a toolbar strip. */}
      <View style={{ flexDirection: 'row', gap: 2, paddingHorizontal: space.xs, paddingBottom: 4 }} accessibilityRole="toolbar">
        {tools.map((t) => (
          <Pressable key={t.label} accessibilityRole="button" accessibilityLabel={t.label} onPress={t.run} hitSlop={4} style={({ pressed }) => ({ height: 30, paddingHorizontal: space.sm, borderRadius: radius.sm, justifyContent: 'center', backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
            <T variant="small" color="textMuted" style={t.label === 'Bold' ? { fontWeight: '800' } : t.label === 'Italic' ? { fontStyle: 'italic' } : { textDecorationLine: 'underline' }}>
              {t.label}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Small, quiet section control (reorder, delete), so the controls don't compete with the writing. */
function Tool({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surfaceAlt : 'transparent', opacity: disabled ? 0.35 : 1 })}>
      <Icon name={icon} size={16} color={c.textMuted} />
    </Pressable>
  );
}
