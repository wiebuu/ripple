import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/theme';

/**
 * A campaign's video, played the way feed ads are: it starts on its own,
 * muted, and loops, with no controls on top. `fill` stretches it over its
 * parent (for full-bleed placements such as a story).
 */
export function CampaignVideo({ uri, style, fill }: { uri: string; style?: StyleProp<ViewStyle>; fill?: boolean }) {
  const { c } = useTheme();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // The player can be created before its view exists (on web the first play() is then ignored),
  // so start it again once the view is up and whenever it has loaded.
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    if (status === 'readyToPlay' && !player.playing) player.play();
  }, [player, status]);
  return (
    <View
      pointerEvents="none"
      style={[fill ? StyleSheet.absoluteFill : { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md }, { overflow: 'hidden', backgroundColor: c.skeleton }, style]}
      accessibilityLabel="Campaign video, playing muted">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}
