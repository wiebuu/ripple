import { useColorScheme } from 'react-native';

/**
 * Design tokens. Calm, editorial palette: warm paper, deep ink, one teal
 * accent. Every colour pair used for text meets WCAG AA contrast.
 */
const light = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceAlt: '#EFECE5',
  text: '#16181B',
  textMuted: '#5E636B',
  textSubtle: '#80858D',
  border: '#E3DFD6',
  primary: '#0D5C50',
  primaryPressed: '#094A40',
  primarySoft: '#DCEDE8',
  onPrimary: '#FFFFFF',
  accent: '#B8651B',
  accentSoft: '#F6E8D9',
  success: '#1E7A46',
  successSoft: '#DFF1E6',
  warning: '#8F5B00',
  warningSoft: '#FBEFD5',
  danger: '#B3261E',
  dangerSoft: '#F9E1DE',
  info: '#2457A5',
  infoSoft: '#E1EAF8',
  track: '#E6E2DA',
  overlay: 'rgba(16,18,20,0.45)',
  skeleton: '#E9E5DD',
};

const dark: typeof light = {
  bg: '#0F1112',
  surface: '#181B1D',
  surfaceAlt: '#212528',
  text: '#F1EEE8',
  textMuted: '#A9AEB4',
  textSubtle: '#80868D',
  border: '#2B3034',
  primary: '#5CC2AE',
  primaryPressed: '#47A895',
  primarySoft: '#16332D',
  onPrimary: '#06221D',
  accent: '#E39A55',
  accentSoft: '#3A2918',
  success: '#62C48A',
  successSoft: '#163323',
  warning: '#E8B550',
  warningSoft: '#3A2D12',
  danger: '#F08A80',
  dangerSoft: '#3D1C19',
  info: '#8DB4F0',
  infoSoft: '#1A2840',
  track: '#2B3034',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: '#24282B',
};

export type Colors = typeof light;

/** 4-pt spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const fonts = {
  serif: 'Newsreader_600SemiBold',
  serifRegular: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
};

export const type = {
  display: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  title: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 27 },
  subheading: { fontFamily: fonts.sansSemibold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 22 },
  reading: { fontFamily: fonts.serifRegular, fontSize: 18, lineHeight: 29 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.sansSemibold, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.sansSemibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  number: { fontFamily: fonts.sansBold, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums' as const] },
};

export type TypeVariant = keyof typeof type;

export function useTheme() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? dark : light;
  return { c, dark: scheme === 'dark', space, radius, type, fonts };
}

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
