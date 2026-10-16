import { useState } from 'react';
import { View } from 'react-native';
import { CATEGORIES, CREATOR_TYPES, SUMMARY_MAX, TITLE_MAX } from '@shared';
import { errorMessage } from '@/lib/api';
import { applySuggestion, askAi, type AiSuggestion } from '@/lib/create';
import { toast } from '@/lib/toast';
import { space } from '@/theme';
import { Field } from '../Field';
import { Sheet } from '../Sheet';
import { Banner, Button, Card, Chip, Pill, T } from '../ui';
import { ImageSlot } from './ImageSlot';
import { FieldError, Label, StepIntro, Tip, type StepProps } from './shared';

export function BasicsStep({ d, update, errors }: StepProps) {
  const b = d.basics;
  const set = (p: Partial<typeof b>) => update((x) => ({ ...x, basics: { ...x.basics, ...p } }));
  const [aiOpen, setAiOpen] = useState(false);
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<{ demo: boolean; s: AiSuggestion } | null>(null);

  const suggest = async () => {
    setBusy(true);
    try {
      const r = await askAi({ about: about || [b.title, b.summary].filter(Boolean).join('. '), audience: '', why: '', evidence: '' });
      setSugg({ demo: r.demo, s: r.suggestion });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.xl }}>
      <StepIntro title="The basics" body="What the campaign is about and who is behind it. You can change any of this later." />
      <Button label="Suggest with AI" icon="sparkles-outline" variant="secondary" onPress={() => setAiOpen(true)} style={{ alignSelf: 'flex-start' }} />

      <Field
        label="Campaign title"
        required
        value={b.title}
        onChangeText={(t) => set({ title: t })}
        max={TITLE_MAX}
        placeholder="e.g. Keep the winter shelter open past 7am"
        helper="The start of your title may be used as the ad headline if you don’t write one in step 3."
        error={errors['basics.title']}
      />

      <View style={{ gap: space.sm }}>
        <Label text="Category" required />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup">
          {CATEGORIES.map((cat) => (
            <Chip key={cat} label={cat} selected={b.category === cat} onPress={() => set({ category: cat })} />
          ))}
        </View>
        <FieldError error={errors['basics.category']} />
      </View>

      <Field label="Creator or organisation name" required value={b.creatorName} onChangeText={(t) => set({ creatorName: t })} max={80} placeholder="Shown as “by …” on your campaign" error={errors['basics.creatorName']} />

      <View style={{ gap: space.sm }}>
        <Label text="You are a…" required />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {CREATOR_TYPES.map((t) => (
            <Chip key={t} label={t} selected={b.creatorType === t} onPress={() => set({ creatorType: t })} />
          ))}
        </View>
      </View>

      <Field
        label="Short summary"
        value={b.summary}
        onChangeText={(t) => set({ summary: t })}
        max={SUMMARY_MAX}
        softMax
        multiline
        placeholder="One or two sentences: what’s happening, and why people should care."
        helper="Shown on campaign cards in the feed."
        error={errors['basics.summary']}
      />

      <View style={{ gap: space.sm }}>
        <Label text="Cover image" hint="Shown on every campaign card. You can also set it in step 3." />
        <ImageSlot uri={b.coverImage || d.visuals.coverImage} category={b.category} onChange={(u) => update((x) => ({ ...x, basics: { ...x.basics, coverImage: u }, visuals: { ...x.visuals, coverImage: u } }))} label="Add a cover image" />
      </View>

      <Tip>Lead with the change you want, not the problem. “Keep the shelter open past 7am” travels further than “Homelessness in our city”.</Tip>

      <Sheet visible={aiOpen} onClose={() => { setAiOpen(false); setSugg(null); }} title="Suggest with AI">
        {!sugg ? (
          <>
            <T color="textMuted">Describe your campaign in a few sentences. AI will suggest a title, summary and category. Nothing changes until you choose to apply it.</T>
            <Field label="What is your campaign about?" required value={about} onChangeText={setAbout} multiline placeholder={b.title || 'e.g. Our library closes at 5pm so working parents can’t use it…'} />
            <Button label="Get suggestions" icon="sparkles-outline" loading={busy} disabled={!about.trim() && !b.title.trim()} onPress={suggest} />
          </>
        ) : (
          <>
            {sugg.demo && <Pill label="Demo AI: offline suggestions" tone="accent" />}
            <Card style={{ gap: space.md }}>
              <Suggest label="Title" value={sugg.s.title} onApply={() => set({ title: sugg.s.title.slice(0, TITLE_MAX) })} />
              <Suggest label="Summary" value={sugg.s.summary} onApply={() => set({ summary: sugg.s.summary.slice(0, SUMMARY_MAX) })} />
              <Suggest label="Category" value={sugg.s.category} onApply={() => set({ category: sugg.s.category as any })} />
            </Card>
            <Button
              label="Apply all and continue editing"
              onPress={() => {
                update((x) => applySuggestion(x, sugg.s, 'basics'));
                setAiOpen(false);
                setSugg(null);
                toast('Suggestions applied. Edit anything you like.');
              }}
            />
            <Banner tone="neutral" icon="create-outline" body="Suggestions are a starting point. You can edit or delete anything AI wrote." />
          </>
        )}
      </Sheet>
    </View>
  );
}

function Suggest({ label, value, onApply }: { label: string; value: string; onApply: () => void }) {
  const [applied, setApplied] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <T variant="overline" color="textMuted">
        {label}
      </T>
      <T>{value || '—'}</T>
      <Button
        label={applied ? 'Applied' : 'Use this'}
        icon={applied ? 'checkmark' : undefined}
        size="sm"
        variant="quiet"
        disabled={!value}
        style={{ alignSelf: 'flex-start' }}
        onPress={() => {
          onApply();
          setApplied(true);
        }}
      />
    </View>
  );
}
