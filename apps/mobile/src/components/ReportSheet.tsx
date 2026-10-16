import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { COMPLAINT_REASONS, type ComplaintReason } from '@shared';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { radius, space, useTheme } from '@/theme';
import { Field } from './Field';
import { Sheet } from './Sheet';
import { Button, Icon, T } from './ui';

/** Audience report about a campaign. Goes to the review team's moderation queue. */
export function ReportSheet({ campaignId, visible, onClose }: { campaignId: string; visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const [reason, setReason] = useState<ComplaintReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/campaigns/${campaignId}/complaints`, { body: { reason, details: details.trim() || undefined } });
      toast('Thanks. Our review team will look at this.');
      setReason(null);
      setDetails('');
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Report this campaign" footer={<Button label="Send report" size="lg" disabled={!reason} loading={busy} onPress={submit} />}>
      <T color="textMuted">Reports go to Ripple’s review team, not to the creator. We may pause distribution while we check.</T>
      <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
        {COMPLAINT_REASONS.map((r) => {
          const sel = reason === r.key;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => setReason(r.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primarySoft : c.surface }}>
              <Icon name={sel ? 'radio-button-on' : 'radio-button-off'} size={20} color={sel ? c.primary : c.textSubtle} />
              <T style={{ flex: 1 }}>{r.label}</T>
            </Pressable>
          );
        })}
      </View>
      <Field label="Details" value={details} onChangeText={setDetails} multiline max={1000} softMax placeholder="What’s wrong? Links or quotes help the reviewer." />
    </Sheet>
  );
}
