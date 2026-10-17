import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { emptyDraft } from '@shared';
import { Footer, Header } from '@/components/Screen';
import { Banner, Button, Icon, Pill, T, haptic, Toggle } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { applySuggestion, askAi, startDraft, type VoiceAnswers } from '@/lib/create';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { fonts, radius, space, useTheme } from '@/theme';
import { RippleLoader } from '@/components/brand/RippleMark';

const QUESTIONS: { key: keyof VoiceAnswers; q: string; hint: string; sample: string }[] = [
  {
    key: 'about',
    q: 'What is your campaign about?',
    hint: 'Say it like you’d explain it to a friend. What’s happening, and what change do you want?',
    sample: 'Our neighbourhood library closes at 5pm on weekdays, so working parents can never take their kids. We want the library board to try one late evening a week.',
  },
  { key: 'audience', q: 'Who needs to hear this?', hint: 'Where do they live? What do they care about?', sample: 'Parents of young kids in Northside, Minneapolis, and anyone who uses the library.' },
  { key: 'why', q: 'Why does it matter now?', hint: 'What happens if nothing changes? Is there a deadline or a decision coming up?', sample: 'The library board sets next year’s hours at its meeting in January, so this is the moment to ask.' },
  { key: 'evidence', q: 'What evidence supports it?', hint: 'Reports, data, articles or your own experience. You’ll add links later.', sample: 'The branch visitor counts drop to almost zero after 4pm, and a parent survey we ran had 120 responses asking for evening hours.' },
];

export default function VoiceCreate() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<VoiceAnswers>({ about: '', audience: '', why: '', evidence: '' });
  const [readAloud, setReadAloud] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const input = useRef<TextInput>(null);
  const q = QUESTIONS[i];
  const last = i === QUESTIONS.length - 1;

  useEffect(() => {
    if (readAloud) {
      Speech.stop();
      Speech.speak(`${QUESTIONS[i].q} ${QUESTIONS[i].hint}`, { rate: 1.0 });
    }
    return () => {
      Speech.stop();
    };
  }, [i, readAloud]);

  const draft = async () => {
    if (!answers.about.trim()) {
      setI(0);
      return toast('Tell us what the campaign is about first', 'error');
    }
    setDrafting(true);
    Speech.stop();
    try {
      const r = await askAi(answers);
      const base = emptyDraft(user && !user.isGuest ? user.name : '');
      const id = await startDraft(applySuggestion(base, r.suggestion));
      toast(r.demo ? 'Draft ready (demo AI). Review every step.' : 'Draft ready. Review every step.');
      router.replace({ pathname: '/create/[id]', params: { id, ai: '1' } });
    } catch (e) {
      toast(errorMessage(e), 'error');
      setDrafting(false);
    }
  };

  if (drafting)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxl }} accessibilityLiveRegion="polite">
        <RippleLoader size={72} />
        <T variant="heading" center>
          Drafting your campaign…
        </T>
        <T color="textMuted" center>
          Turning your answers into a title, story outline and ad copy. You’ll be able to edit everything.
        </T>
      </View>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Create with your voice" onBack={() => (i > 0 ? setI(i - 1) : router.back())} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Question ${i + 1} of 4`}>
          {QUESTIONS.map((x, j) => (
            <View key={x.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: j <= i ? c.primary : c.track }} />
          ))}
        </View>
        <View style={{ gap: space.sm }}>
          <T variant="overline" color="primary">
            Question {i + 1} of 4
          </T>
          <T variant="title">{q.q}</T>
          <T color="textMuted">{q.hint}</T>
        </View>

        <View style={{ borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.primary, backgroundColor: c.surface, overflow: 'hidden' }}>
          <TextInput
            ref={input}
            key={q.key}
            value={answers[q.key]}
            onChangeText={(t) => setAnswers((a) => ({ ...a, [q.key]: t }))}
            autoFocus
            multiline
            maxLength={1500}
            placeholder="Tap the microphone on your keyboard and start talking…"
            placeholderTextColor={c.textSubtle}
            accessibilityLabel={q.q}
            style={{ minHeight: 170, padding: space.lg, fontFamily: fonts.sans, fontSize: 18, lineHeight: 27, color: c.text, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: c.primarySoft }}>
            <Icon name="mic" size={18} color={c.primary} />
            <T variant="small" style={{ flex: 1 }}>
              Use the 🎤 key on your keyboard to dictate. You can edit the text afterwards.
            </T>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button label="Hear the question" icon="volume-high-outline" variant="quiet" size="sm" onPress={() => { haptic.light(); Speech.stop(); Speech.speak(`${q.q} ${q.hint}`); }} />
          <Button label="Use a sample answer" icon="flask-outline" variant="quiet" size="sm" onPress={() => setAnswers((a) => ({ ...a, [q.key]: q.sample }))} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <T style={{ flex: 1 }}>Read questions aloud</T>
          <Toggle value={readAloud} onValueChange={setReadAloud} accessibilityLabel="Read questions aloud" />
        </View>

        <Banner
          tone="neutral"
          icon="information-circle-outline"
          body="AI drafts suggestions from your answers. You’ll land on an editable draft: nothing is submitted, and you set the funding goal yourself."
          action={<View style={{ marginTop: 6 }}><Pill label="Speech-to-text by your keyboard" tone="neutral" /></View>}
        />
      </ScrollView>
      <Footer>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {i > 0 && <Button label="Back" variant="secondary" style={{ flex: 1 }} onPress={() => setI(i - 1)} />}
          {last ? (
            <Button label="Draft my campaign" icon="sparkles" style={{ flex: 2 }} onPress={draft} />
          ) : (
            <Button label={answers[q.key].trim() ? 'Next question' : 'Skip'} iconRight="arrow-forward" style={{ flex: 2 }} onPress={() => { haptic.light(); setI(i + 1); }} />
          )}
        </View>
        <Button label="Switch to the manual editor" variant="ghost" size="sm" onPress={async () => { try { const id = await startDraft(); router.replace({ pathname: '/create/[id]', params: { id } }); } catch (e) { toast(errorMessage(e), 'error'); } }} />
      </Footer>
    </KeyboardAvoidingView>
  );
}
