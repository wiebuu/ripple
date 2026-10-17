import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { T, haptic } from './ui';

/** Short labels so all six stages fit on one track. */
const STAGE_LABEL: Record<string, string> = { drafts: 'Drafts', review: 'In review', action: 'Needs action', funding: 'Funding', promoting: 'Live', completed: 'Done' };
const NODE = 40;

/**
 * A campaign's lifecycle as circles on one track: each stage shows how many of
 * your campaigns are there. Filled green = campaigns at that stage; an orange
 * ring = needs you. Used on Profile (tap to open that list) and as the stage
 * selector on My campaigns, where `selected` gets a ring and a bold label.
 */
export function StageTrack({
  counts,
  loading,
  selected,
  onSelect,
}: {
  counts: { key: string; label: string; n: number }[];
  loading?: boolean;
  selected?: string;
  onSelect: (key: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row' }} accessibilityRole={selected ? 'tablist' : undefined}>
      {/* The track runs behind the nodes, from the first centre to the last. */}
      <View style={{ position: 'absolute', top: NODE / 2 + 3 - 1, left: `${100 / 12}%`, right: `${100 / 12}%`, height: 2, borderRadius: 1, backgroundColor: c.track }} />
      {counts.map((t) => {
        const warn = t.key === 'action' && t.n > 0;
        const on = t.n > 0;
        const isSel = selected === t.key;
        return (
          <Pressable
            key={t.key}
            accessibilityRole={selected ? 'tab' : 'button'}
            accessibilityState={selected ? { selected: isSel } : undefined}
            accessibilityLabel={`${t.label}: ${t.n}`}
            onPress={() => {
              haptic.light();
              onSelect(t.key);
            }}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
            {/* Selection ring sits 3pt outside the node, so every node keeps the same size and the track stays aligned. */}
            <View style={{ padding: 1, borderRadius: NODE, borderWidth: 2, borderColor: isSel ? (warn ? c.warning : c.primary) : 'transparent' }}>
              <View
                style={{
                  width: NODE,
                  height: NODE,
                  borderRadius: NODE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: warn ? c.warningSoft : on ? c.primary : c.bg,
                  borderWidth: warn ? 2 : on ? 0 : 1.5,
                  borderColor: warn ? c.warning : c.border,
                }}>
                <T variant="bodyStrong" style={{ color: warn ? c.warning : on ? c.onPrimary : c.textSubtle, fontVariant: ['tabular-nums'] }}>
                  {loading ? '–' : t.n}
                </T>
              </View>
            </View>
            <T variant="small" center numberOfLines={2} style={{ fontSize: 11, lineHeight: 14, fontWeight: isSel ? '700' : '400', color: warn ? c.warning : isSel || on ? c.text : c.textMuted }}>
              {STAGE_LABEL[t.key] ?? t.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
