import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { emptyDraft } from '@shared';
import { RippleLoader } from '@/components/brand/RippleMark';
import { Field } from '@/components/Field';
import { Footer, Header } from '@/components/Screen';
import { AiBadge, Banner, Button, Icon, Pill, T, haptic, type IconName } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { WIECODES_ANSWERS } from '@/lib/autofill';
import { applySuggestion, askAi, startDraft, type AiSuggestion, type VoiceAnswers } from '@/lib/create';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { space, useTheme } from '@/theme';

const QUESTIONS: { key: keyof VoiceAnswers; label: string; helper: string; placeholder: string; required?: boolean }[] = [
  {
    key: 'about',
    label: 'What is your campaign about?',
    helper: 'What’s happening, and what change do you want?',
    placeholder: 'e.g. Our library closes at 5pm on weekdays, so working parents can never take their kids. We want one late evening a week.',
    required: true,
  },
  { key: 'audience', label: 'Who needs to hear it?', helper: 'Where they live and what they care about.', placeholder: 'e.g. Parents of young kids in Northside, and anyone who uses the library.' },
  { key: 'why', label: 'Why now?', helper: 'A deadline, a decision coming up, or what happens if nothing changes.', placeholder: 'e.g. The board sets next year’s hours in January.' },
  { key: 'evidence', label: 'What backs it up?', helper: 'Reports, numbers or first-hand experience. You add the links later.', placeholder: 'e.g. A parent survey with 120 responses asking for evening hours.' },
];
const EMPTY: VoiceAnswers = { about: '', audience: '', why: '', evidence: '' };
/** The first answer needs enough to write from. */
const MIN_ABOUT = 20;

type Result = { demo: boolean; suggestion: AiSuggestion };

/**
 * Quick draft: four short questions (typed or dictated with the keyboard's
 * microphone) become a full first draft: title, summary, story outline, ad copy
 * and audience. The draft is shown for review before it opens in the editor,
 * and nothing is saved until the creator chooses to continue.
 */
export default function QuickDraft() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const [answers, setAnswers] = useState<VoiceAnswers>(EMPTY);
  const [phase, setPhase] = useState<'answers' | 'drafting' | 'review'>('answers');
  const [result, setResult] = useState<Result | null>(null);
  const [opening, setOpening] = useState(false);
  const answered = QUESTIONS.filter((q) => answers[q.key].trim()).length;
  const ready = answers.about.trim().length >= MIN_ABOUT;

  const draft = async () => {
    if (!ready) return toast(`Describe the campaign in a sentence or two first (at least ${MIN_ABOUT} characters).`, 'error');
    haptic.light();
    setPhase('drafting');
    try {
      setResult(await askAi(answers));
      setPhase('review');
    } catch (e) {
      toast(errorMessage(e), 'error');
      setPhase('answers');
    }
  };

  const openEditor = async () => {
    if (!result) return;
    setOpening(true);
    try {
      const base = emptyDraft(user && !user.isGuest ? user.name : '');
      const id = await startDraft(applySuggestion(base, result.suggestion));
      router.replace({ pathname: '/create/[id]', params: { id, ai: '1' } });
    } catch (e) {
      toast(errorMessage(e), 'error');
      setOpening(false);
    }
  };

  const blank = async () => {
    try {
      const id = await startDraft();
      router.replace({ pathname: '/create/[id]', params: { id } });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (phase === 'drafting')
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Quick draft" back={false} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxl }} accessibilityLiveRegion="polite">
          <RippleLoader size={72} />
          <T variant="heading" center>
            Writing your draft
          </T>
          <View style={{ gap: space.sm, alignSelf: 'stretch', paddingHorizontal: space.lg }}>
            {(['Title and summary', 'Story outline', 'Ad copy', 'Audience'] as const).map((x) => (
              <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                <T color="textMuted">{x}</T>
              </View>
            ))}
          </View>
        </View>
      </View>
    );

  if (phase === 'review' && result) return <Review result={result} onBack={() => setPhase('answers')} onOpen={openEditor} opening={opening} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title="Quick draft"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fill with an example"
            hitSlop={8}
            onPress={() => {
              haptic.light();
              setAnswers(WIECODES_ANSWERS);
              toast('Filled with an example campaign for Wiecodes. Edit anything, then create the draft.');
            }}
            style={({ pressed }) => ({ height: 44, paddingHorizontal: space.md, justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
            <AiBadge large solid />
          </Pressable>
        }
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: space.xl, paddingBottom: space.huge }}>
        <View style={{ gap: space.sm }}>
          <T variant="title">Describe your campaign</T>
          <T color="textMuted">Answer in your own words and we’ll write a full first draft. You review it before anything is saved.</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs }}>
            <Icon name="mic-outline" size={16} color={c.textMuted} />
            <T variant="small" color="textMuted" style={{ flex: 1 }}>
              Prefer talking? Tap the microphone on your keyboard to dictate.
            </T>
          </View>
        </View>

        <View style={{ gap: 6 }} accessibilityLabel={`${answered} of ${QUESTIONS.length} questions answered`}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {QUESTIONS.map((q) => (
              <View key={q.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: answers[q.key].trim() ? c.primary : c.track }} />
            ))}
          </View>
          <T variant="small" color="textSubtle">
            {answered} of {QUESTIONS.length} answered · only the first is required
          </T>
        </View>

        {QUESTIONS.map((q) => (
          <View key={q.key} style={{ gap: 4 }}>
            <Field
              label={q.label}
              required={q.required}
              multiline
              value={answers[q.key]}
              onChangeText={(t) => setAnswers((a) => ({ ...a, [q.key]: t }))}
              maxLength={1000}
              placeholder={q.placeholder}
              style={{ minHeight: q.required ? 120 : 88 }}
            />
            <T variant="small" color="textMuted">
              {q.helper}
            </T>
          </View>
        ))}
      </ScrollView>
      <Footer>
        <Button label="Create my draft" iconRight="arrow-forward" disabled={!ready} onPress={draft} />
        <Button label="Start with a blank editor instead" variant="ghost" size="sm" onPress={blank} />
      </Footer>
    </KeyboardAvoidingView>
  );
}

/** The generated draft at a glance, before it becomes a saved draft in the editor. */
function Review({ result, onBack, onOpen, opening }: { result: Result; onBack: () => void; onOpen: () => void; opening: boolean }) {
  const { c } = useTheme();
  const s = result.suggestion;
  const audience = [...s.locations, ...s.interests].filter(Boolean);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Your draft" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.md, gap: space.xl, paddingBottom: space.huge }}>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            {!!s.category && <Pill label={s.category} tone="primary" />}
            {result.demo && <Pill label="Sample wording" tone="neutral" />}
          </View>
          <T variant="title">{s.title}</T>
          <T color="textMuted">{s.summary}</T>
        </View>

        <View style={{ height: 1, backgroundColor: c.border }} />

        <Section icon="document-text-outline" title="Story">
          <T variant="bodyStrong">{s.headline}</T>
          {s.sections.map((sec) => (
            <View key={sec.heading} style={{ flexDirection: 'row', gap: space.sm }}>
              <T color="textSubtle">•</T>
              <T style={{ flex: 1 }}>{sec.heading}</T>
            </View>
          ))}
        </Section>

        <Section icon="megaphone-outline" title="Ad">
          <T variant="bodyStrong">{s.adHeadline}</T>
          <T color="textMuted">{s.adDescription}</T>
          <T variant="smallStrong" color="primary">
            Button: {s.ctaText || 'Learn more'}
          </T>
        </Section>

        {audience.length > 0 && (
          <Section icon="people-outline" title="Audience">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {audience.slice(0, 8).map((a) => (
                <Pill key={a} label={a} tone="neutral" />
              ))}
            </View>
          </Section>
        )}

        {s.sourcesToAdd.length > 0 && (
          <Section icon="link-outline" title={`Sources to add (${s.sourcesToAdd.length})`}>
            {s.sourcesToAdd.map((x) => (
              <View key={x.title} style={{ flexDirection: 'row', gap: space.sm }}>
                <T color="textSubtle">•</T>
                <T style={{ flex: 1 }}>{x.title}</T>
              </View>
            ))}
          </Section>
        )}

        <Banner
          tone="neutral"
          icon="information-circle-outline"
          body={`${result.demo ? 'The writing service is unavailable, so this uses sample wording built from your answers. ' : ''}Everything stays editable. Add links for the sources and set your own funding goal before you submit.`}
        />
      </ScrollView>
      <Footer>
        <Button label="Open in the editor" iconRight="arrow-forward" loading={opening} onPress={onOpen} />
        <Button label="Change my answers" variant="ghost" size="sm" onPress={onBack} />
      </Footer>
    </View>
  );
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name={icon} size={18} color={c.primary} />
        <T variant="overline" color="textMuted">
          {title}
        </T>
      </View>
      <View style={{ gap: 6, paddingLeft: 26 }}>{children}</View>
    </View>
  );
}
