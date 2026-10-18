import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View, Pressable } from 'react-native';
import { STATUS_META, STEP_SHORT, STEP_VALIDATORS, STEPS, firstInvalidStep, validateAll } from '@shared';
import { AiSheet } from '@/components/create/AiSheet';
import { BasicsStep } from '@/components/create/BasicsStep';
import { ReachStep } from '@/components/create/ReachStep';
import { SaveIndicator, StepProgress } from '@/components/create/shared';
import { StoryStep } from '@/components/create/StoryStep';
import { SubmitStep } from '@/components/create/SubmitStep';
import { VisualsStep } from '@/components/create/VisualsStep';
import { ErrorScope, useErrorFocus } from '@/components/ErrorFocus';
import { Footer, Header } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Banner, Button, EmptyState, IconButton, Skeleton, T, haptic, AiBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useDraftEditor } from '@/lib/draft';
import { invalidateCampaign } from '@/lib/queries';
import { formatMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import { space, useTheme } from '@/theme';

const LIVE = ['FUNDING', 'FUNDED', 'FUNDING_ENDED', 'DISTRIBUTION_PREP', 'PROMOTING'];
const LOCKED = ['SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'FAILED'];

export default function CampaignEditor() {
  const { id, ai } = useLocalSearchParams<{ id: string; ai?: string }>();
  const { c } = useTheme();
  const ed = useDraftEditor(id);
  const scroll = useRef<ScrollView>(null);
  // Takes the person to the first field that still needs something after a failed Next/Submit.
  const errorFocus = useErrorFocus(scroll);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // Bumped to open Basics' title-and-summary suggestions from the AI sheet.
  const [suggestSignal, setSuggestSignal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const step = ed.step;

  const goTo = (n: number) => {
    ed.setStep(n);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const exit = async () => {
    await ed.saveNow();
    if (router.canGoBack()) router.back();
    else router.replace('/create');
  };
  const back = () => (step > 0 ? goTo(step - 1) : exit());
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });

  // Android hardware back moves to the previous step instead of leaving the editor.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        backRef.current();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  if (!ed.content) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title="Campaign editor" />
        {ed.remote.isError ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn’t open this draft" body={errorMessage(ed.remote.error)} action={<Button label="Try again" variant="secondary" onPress={() => ed.remote.refetch()} />} />
        ) : (
          <View style={{ padding: space.xl, gap: space.lg }}>
            <Skeleton h={8} />
            <Skeleton h={32} w="60%" />
            <Skeleton h={48} />
            <Skeleton h={120} />
          </View>
        )}
      </View>
    );
  }

  const d = ed.content;
  const status = ed.status ?? 'DRAFT';
  const live = LIVE.includes(status);

  if (LOCKED.includes(status)) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Header title={d.basics.title || 'Campaign'} />
        <EmptyState
          icon="lock-closed-outline"
          title={STATUS_META[status].label}
          body={`${STATUS_META[status].description} Editing is paused in this state.`}
          action={<Button label="Manage campaign" onPress={() => router.replace({ pathname: '/manage/[id]', params: { id } })} />}
        />
      </View>
    );
  }

  const invalid = STEP_VALIDATORS.map((fn) => Object.keys(fn(d)).length > 0);
  const errors = attempted.has(step) ? STEP_VALIDATORS[step](d) : {};
  const update = ed.update;

  const next = () => {
    const errs = STEP_VALIDATORS[step](d);
    if (Object.keys(errs).length) {
      haptic.warn();
      setAttempted((s) => new Set(s).add(step));
      toast(`${Object.keys(errs).length === 1 ? 'One thing needs' : `${Object.keys(errs).length} things need`} your attention`, 'error');
      errorFocus.focusFirst();
      return;
    }
    haptic.light();
    goTo(step + 1);
  };

  const trySubmit = () => {
    const all = validateAll(d);
    if (Object.keys(all).length) {
      haptic.warn();
      setAttempted(new Set([0, 1, 2, 3, 4]));
      const first = firstInvalidStep(d);
      toast(`Finish ${STEPS[first]} before submitting`, 'error');
      if (first !== step) goTo(first);
      // A new step needs a moment to render before its fields can be measured.
      errorFocus.focusFirst(first !== step ? 250 : 60);
      return;
    }
    setConfirm(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const ok = await ed.saveNow();
      if (ok === false) throw new Error(ed.saveError ?? 'Couldn’t save your latest changes. Check your connection.');
      await api(`/drafts/${id}/${live ? 'submit-revision' : 'submit'}`, { body: {} });
      invalidateCampaign(id);
      setConfirm(false);
      router.replace({ pathname: '/create/submitted/[id]', params: { id, revision: live ? '1' : undefined } });
    } catch (e: any) {
      const step = e?.details?.step;
      toast(errorMessage(e), 'error');
      if (typeof step === 'number') {
        setAttempted(new Set([0, 1, 2, 3, 4]));
        goTo(step);
      }
      setConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const props = { d, update, errors, draftId: id };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title={live ? 'Edit live campaign' : d.basics.title ? 'Edit draft' : 'New campaign'}
        subtitle={<SaveIndicator state={ed.saveState} savedAt={ed.savedAt} error={ed.saveError} />}
        onBack={back}
        right={
          <View style={{ flexDirection: 'row' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Auto-fill" hitSlop={8} onPress={() => setAiOpen(true)} style={({ pressed }) => ({ height: 44, paddingHorizontal: 4, justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
              <AiBadge large solid />
            </Pressable>
            <IconButton icon="eye-outline" label="Preview campaign" onPress={() => router.push({ pathname: '/create/preview/[id]', params: { id } })} />
          </View>
        }
      />
      <StepProgress step={step} onJump={goTo} invalid={invalid} />

      <ScrollView ref={scroll} onScroll={errorFocus.onScroll} scrollEventThrottle={32} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, paddingTop: space.lg, gap: space.xl, paddingBottom: space.huge }}>
        <ErrorScope registry={errorFocus.registry}>
        {status === 'CHANGES_REQUESTED' && <Banner tone="warning" icon="chatbubble-ellipses-outline" title="Changes requested by reviewer" body={ed.reviewNote ?? 'Update your campaign and submit it again.'} />}
        {live && <Banner tone="info" icon="shield-checkmark-outline" title="This campaign is live" body="Edits are saved as a revision. Your public page and ads keep the approved version until a reviewer approves the changes. The funding goal can’t change." />}
        {ai === '1' && step === 0 && <Banner tone="accent" icon="create-outline" title="Drafted from your answers" body="Read every step and change anything that isn’t right. Add real links for the suggested sources, and set your own funding goal in Submit." />}
        {step === 0 && <BasicsStep {...props} suggestSignal={suggestSignal} />}
        {step === 1 && <StoryStep {...props} />}
        {step === 2 && <VisualsStep {...props} />}
        {step === 3 && <ReachStep {...props} />}
        {step === 4 && <SubmitStep {...props} onJump={goTo} />}
        </ErrorScope>
      </ScrollView>

      <Footer>
        {step < 4 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Button label="Save & exit" variant="ghost" size="sm" onPress={async () => { await ed.saveNow(); toast('Draft saved. Resume any time from Create.'); exit(); }} />
            <Button label={`Next: ${STEP_SHORT[step + 1]}`} iconRight="arrow-forward" style={{ flex: 1 }} onPress={next} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Button label="Preview" variant="ghost" size="sm" onPress={() => router.push({ pathname: '/create/preview/[id]', params: { id } })} />
              <Button label={live ? 'Submit edits for review' : 'Submit for review'} icon="paper-plane-outline" style={{ flex: 1 }} onPress={trySubmit} />
            </View>
          </>
        )}
      </Footer>

      <AiSheet visible={aiOpen} onClose={() => setAiOpen(false)} step={step} update={update} onSuggestBasics={() => setSuggestSignal((n) => n + 1)} />

      <Sheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title={live ? 'Submit your edits?' : 'Submit for review?'}
        footer={
          <View style={{ gap: space.sm }}>
            <Button label="Yes, submit" size="lg" loading={submitting} onPress={submit} />
            <Button label="Keep editing" variant="ghost" size="sm" onPress={() => setConfirm(false)} />
          </View>
        }>
        <T>
          {live
            ? 'A reviewer will compare your changes with the approved version. Your live page and ads stay as they are until the changes are approved.'
            : 'Our team will check your sources, visuals and targeting. Editing is paused while we review. We’ll notify you when it’s approved or if changes are needed.'}
        </T>
        <T variant="small" color="textMuted">
          Funding goal: {d.goal != null ? formatMoney(d.goal) : '—'} · Ads run {d.reach.durationDays} days
        </T>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
