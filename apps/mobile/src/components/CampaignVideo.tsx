import { useVideoPlayer, VideoView } from 'expo-video';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/theme';

/**
 * A campaign's video: starts muted and loops (like a feed ad), with native
 * controls so people can unmute, pause or go fullscreen.
 */
export function CampaignVideo({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={[{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.skeleton }, style]}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls fullscreenOptions={{ enable: true }} />
    </View>
  );
}
