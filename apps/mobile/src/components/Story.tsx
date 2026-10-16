import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import type { Source, Story as StoryT, StoryBlock } from '@shared';
import { radius, space, useTheme } from '@/theme';
import { Icon, T } from './ui';

/**
 * Minimal inline formatting used by the story composer toolbar:
 * **bold**, _italic_ and [link text](https://...).
 */
export function RichText({ text, variant = 'reading' }: { text: string; variant?: 'reading' | 'body' }) {
  const { c, fonts } = useTheme();
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<T key={i++} variant={variant} style={{ fontFamily: fonts.sansBold }}>{tok.slice(2, -2)}</T>);
    else if (tok.startsWith('_')) parts.push(<T key={i++} variant={variant} style={{ fontFamily: fonts.sansItalic }}>{tok.slice(1, -1)}</T>);
    else {
      const [, label, url] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      parts.push(
        <T key={i++} variant={variant} accessibilityRole="link" style={{ color: c.primary, textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(url)}>
          {label}
        </T>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <T variant={variant}>{parts}</T>;
}

function SourceRef({ index, onPress }: { index: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Source ${index}`} onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: c.primarySoft, alignSelf: 'flex-start' }}>
      <T variant="smallStrong" color="primary" style={{ fontSize: 11 }}>
        Source {index}
      </T>
    </Pressable>
  );
}

export function Block({ b, sources }: { b: StoryBlock; sources: Source[] }) {
  const { c } = useTheme();
  const openSource = (id?: string) => {
    const s = sources.find((x) => x.id === id);
    if (s) WebBrowser.openBrowserAsync(s.url);
  };
  switch (b.type) {
    case 'heading':
      return (
        <T variant="heading" accessibilityRole="header" style={{ marginTop: space.md }}>
          {b.text}
        </T>
      );
    case 'paragraph':
      return b.text ? <RichText text={b.text} /> : null;
    case 'image':
      return b.uri ? (
        <View style={{ gap: 6, marginVertical: space.xs }}>
          <Image source={b.uri} style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: radius.md, backgroundColor: c.skeleton }} contentFit="cover" accessibilityLabel={b.caption || 'Story image'} />
          {(b.caption || b.credit) && (
            <T variant="small" color="textMuted">
              {b.caption}
              {b.credit ? <T variant="small" color="textSubtle">{`  Photo: ${b.credit}`}</T> : null}
            </T>
          )}
        </View>
      ) : null;
    case 'stat': {
      const idx = sources.findIndex((s) => s.id === b.sourceId);
      return (
        <View style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: space.lg, paddingVertical: space.xs, gap: 4 }}>
          <T variant="display" style={{ color: c.accent }}>
            {b.value}
          </T>
          <T color="textMuted">{b.label}</T>
          {idx >= 0 && <SourceRef index={idx + 1} onPress={() => openSource(b.sourceId)} />}
        </View>
      );
    }
    case 'quote':
      return (
        <View style={{ paddingVertical: space.sm, gap: 6 }}>
          <Icon name="chatbox-ellipses-outline" size={20} color={c.textSubtle} />
          <T variant="heading" style={{ fontSize: 21, lineHeight: 29 }}>
            “{b.text}”
          </T>
          {!!b.attribution && (
            <T variant="small" color="textMuted">
              — {b.attribution}
            </T>
          )}
        </View>
      );
  }
}

export function SourceList({ sources }: { sources: Source[] }) {
  const { c } = useTheme();
  if (!sources.length) return <T color="textMuted">No sources were added.</T>;
  return (
    <View style={{ gap: space.sm }}>
      {sources.map((s, i) => (
        <Pressable
          key={s.id}
          accessibilityRole="link"
          accessibilityLabel={`Source ${i + 1}: ${s.title}`}
          onPress={() => s.url && WebBrowser.openBrowserAsync(s.url)}
          style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.8 : 1 })}>
          <T variant="smallStrong" color="primary" style={{ width: 18 }}>
            {i + 1}
          </T>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyStrong">{s.title || 'Untitled source'}</T>
            <T variant="small" color="textMuted" numberOfLines={1}>
              {s.publisher ? `${s.publisher} · ` : ''}
              {s.url.replace(/^https?:\/\/(www\.)?/, '')}
            </T>
          </View>
          <Icon name="open-outline" size={16} color={c.textSubtle} />
        </Pressable>
      ))}
    </View>
  );
}

/** Full editorial story. Used by the public page, the creator preview and the reviewer view. */
export function StoryView({ story }: { story: StoryT }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.lg }}>
      {story.headline ? <T variant="title">{story.headline}</T> : null}
      {story.intro ? (
        <T variant="reading" style={{ fontSize: 19, lineHeight: 30, color: c.text }}>
          {story.intro}
        </T>
      ) : null}
      {story.blocks.map((b) => (
        <Block key={b.id} b={b} sources={story.sources} />
      ))}
      {story.actions.filter(Boolean).length > 0 && (
        <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: c.primarySoft, gap: space.sm, marginTop: space.sm }}>
          <T variant="overline" color="primary">
            What you can do
          </T>
          {story.actions.filter(Boolean).map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
              <Icon name="arrow-forward-circle" size={18} color={c.primary} style={{ marginTop: 2 }} />
              <T style={{ flex: 1 }}>{a}</T>
            </View>
          ))}
        </View>
      )}
      <View style={{ gap: space.md, marginTop: space.sm }}>
        <T variant="overline" color="textMuted">
          Sources
        </T>
        <SourceList sources={story.sources} />
      </View>
    </View>
  );
}
