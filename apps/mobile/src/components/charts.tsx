import { type ReactNode, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatReach } from '@/lib/format';
import { space, useTheme } from '@/theme';
import { T } from './ui';

const shortDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Single-series area chart for a value over days (e.g. impressions per day).
 * One hue, thin 2px line on a soft fill, recessive baseline. Slide a finger
 * along the chart (or tap) to read any day; the readout follows the finger and
 * stays on the last day touched. Before any touch, the peak day is shown.
 */
export function AreaChart({ data, unit, height = 132 }: { data: { day: string; value: number }[]; unit: string; height?: number }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  if (data.length < 2) return null;

  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const pad = 6;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - v / max);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const shown = active ?? peak;

  const pick = (px: number) => {
    if (!w) return;
    const i = Math.round(((px - pad) / (w - pad * 2)) * (data.length - 1));
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  };

  // A sideways drag claims the chart and scrubs through days as the finger moves; an up/down drag
  // still scrolls the page. A tap jumps to that day.
  const scrub = Gesture.Race(
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-4, 4])
      .failOffsetY([-14, 14])
      .onStart((e) => pick(e.x))
      .onUpdate((e) => pick(e.x)),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => pick(e.x)),
  );

  return (
    <View style={{ gap: space.sm }}>
      {/* Readout above the plot: the touched day, or the peak by default. Text stays in text colours. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T variant="subheading" style={{ fontVariant: ['tabular-nums'] }}>
          {formatReach(data[shown].value)}
        </T>
        <T variant="small" color="textMuted">
          {unit} · {shortDay(data[shown].day)}
          {active == null || active === peak ? ' (peak day)' : ''}
        </T>
      </View>
      <GestureDetector gesture={scrub}>
      <View
        collapsable={false}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={`${unit} per day, ${shortDay(data[0].day)} to ${shortDay(data[data.length - 1].day)}. Peak ${formatReach(data[peak].value)} on ${shortDay(data[peak].day)}.`}
        style={{ height }}>
        {w > 0 && (
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.primary} stopOpacity={0.28} />
                <Stop offset="1" stopColor={c.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={w} y1={height - 0.5} y2={height - 0.5} stroke={c.border} strokeWidth={1} />
            <Path d={area} fill="url(#areaFill)" />
            <Path d={line} fill="none" stroke={c.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <Line x1={x(shown)} x2={x(shown)} y1={pad} y2={height} stroke={c.border} strokeWidth={1} strokeDasharray="3 3" />
            {/* Marker with a surface ring so it reads on top of the line. */}
            <Circle cx={x(shown)} cy={y(data[shown].value)} r={5} fill={c.primary} stroke={c.bg} strokeWidth={2} />
          </Svg>
        )}
      </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="small" color="textSubtle" style={{ fontSize: 11 }}>
          {shortDay(data[0].day)}
        </T>
        <T variant="small" color="textSubtle" style={{ fontSize: 11 }}>
          {shortDay(data[data.length - 1].day)}
        </T>
      </View>
    </View>
  );
}

/**
 * Horizontal bars for a share-of-total breakdown (e.g. impressions per app).
 * One hue; each row is direct-labelled with its name, value and share.
 */
export function BarList({ rows }: { rows: { key: string; label: string; leading?: ReactNode; value: number; sub?: string }[] }) {
  const { c } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <View style={{ gap: space.md }}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 6 }} accessibilityLabel={`${r.label}: ${formatReach(r.value)}, ${Math.round((r.value / total) * 100)} percent`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {r.leading}
            <T variant="smallStrong" style={{ flex: 1 }} numberOfLines={1}>
              {r.label}
            </T>
            <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {formatReach(r.value)}
            </T>
            <T variant="small" color="textMuted" style={{ width: 38, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {Math.round((r.value / total) * 100)}%
            </T>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' }}>
            <View style={{ width: `${(r.value / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
          </View>
          {!!r.sub && (
            <T variant="small" color="textMuted" style={{ fontSize: 12 }}>
              {r.sub}
            </T>
          )}
        </View>
      ))}
    </View>
  );
}

/** Tiny trend line with a soft fill, for previews (no axes or readout). */
export function Sparkline({ values, height = 44 }: { values: number[]; height?: number }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const x = (i: number) => (i * w) / (values.length - 1);
  const y = (v: number) => 2 + (height - 4) * (1 - v / max);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.primary} stopOpacity={0.22} />
              <Stop offset="1" stopColor={c.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={`${line} L${w},${height} L0,${height} Z`} fill="url(#sparkFill)" />
          <Path d={line} fill="none" stroke={c.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      )}
    </View>
  );
}
