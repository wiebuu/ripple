import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

/** Colours are baked into the PNGs (tinting is unreliable on web). Ink is the reversed look for green surfaces. */
const SOURCES = {
  accent: require('../../../assets/images/ripple-pattern.png'),
  ink: require('../../../assets/images/ripple-pattern-ink.png'),
};

/** One fixed tile size everywhere, so the swirls look identical on every surface. */
const TILE_W = 700;
const TILE_H = 440.5;
/** Enough rows to cover the tallest card or a full screen; the parent clips the rest. */
const ROWS = 3;

/**
 * Low-contrast swirl texture used sparingly as a background accent.
 * Fills its parent from the top-left; tiles are mirrored so the seams line up.
 * Tiles are laid out up front (no measuring), so it always draws.
 */
export function TigerPattern({ tone = 'accent', opacity, style }: { tone?: keyof typeof SOURCES; opacity?: number; style?: StyleProp<ViewStyle> }) {
  const { dark } = useTheme();
  const { width, height } = useWindowDimensions();
  // Same size everywhere; strength is tuned per backdrop so it reads equally (green on dark, green on white, ink on green).
  const alpha = opacity ?? (tone === 'ink' ? 0.2 : dark ? 0.12 : 0.22);
  const cols = Math.max(1, Math.ceil(width / TILE_W));
  const rows = Math.max(ROWS, Math.ceil(height / TILE_H));
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: alpha }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const col = i % cols;
        return (
          <Image
            key={i}
            source={SOURCES[tone]}
            contentFit="fill"
            cachePolicy="memory-disk"
            style={{
              position: 'absolute',
              left: col * TILE_W,
              top: r * TILE_H,
              width: TILE_W,
              height: TILE_H,
              transform: [{ scaleX: col % 2 ? -1 : 1 }, { scaleY: r % 2 ? -1 : 1 }],
            }}
          />
        );
      })}
    </View>
  );
}
