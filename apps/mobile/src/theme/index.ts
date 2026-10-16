import { useColorScheme } from 'react-native';
import { useAppearance } from '@/lib/appearance';

/**
 * Design tokens. Premium monochrome (black / warm greys) with a single
 * emerald accent (growth, support, "go"), used sparingly for the main action,
 * progress and the ripple motif. Supporting colours are quiet: sage for
 * neutral tags, terracotta for warnings, red for errors. No yellows.
 */
const light = {
  bg: '#F4F3F1',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEBE8',
  text: '#111113',
  textMuted: '#5F5F66',
  textSubtle: '#8A8A91',
  border: '#E2E0DC',
  primary: '#127A4B',
  primaryPressed: '#0E6640',
  primarySoft: '#E2F3EA',
  /** Loading spinners: a brighter green than text-safe primary so they feel light. */
  spinner: '#2DAA6E',
  onPrimary: '#FFFFFF',
  accent: '#4E6A60',
  accentSoft: '#E8EFEB',
  success: '#1F7A80',
  successSoft: '#E0F0F1',
  warning: '#B4561E',
  warningSoft: '#FBEADF',
  danger: '#C0302E',
  dangerSoft: '#FAE3E2',
  info: '#3F5F8A',
  infoSoft: '#E6ECF3',
  track: '#E2E0DC',
  overlay: 'rgba(10,10,12,0.5)',
  skeleton: '#E6E4E0',
  ink: '#111113',
  onInk: '#F4F2EE',
};

const dark: typeof light = {
  bg: '#0B0B0C',
  surface: '#151517',
  surfaceAlt: '#1E1E21',
  text: '#F4F2EE',
  textMuted: '#A3A3A8',
  textSubtle: '#76767C',
  border: '#2A2A2E',
  primary: '#3FCF8E',
  primaryPressed: '#2FB57A',
  primarySoft: '#11241A',
  spinner: '#3FCF8E',
  onPrimary: '#04140B',
  accent: '#9FB8AD',
  accentSoft: '#18211D',
  success: '#62C6CC',
  successSoft: '#122426',
  warning: '#EE9460',
  warningSoft: '#2A1A11',
  danger: '#F07272',
  dangerSoft: '#2C1414',
  info: '#93AED6',
  infoSoft: '#17202C',
  track: '#2A2A2E',
  overlay: 'rgba(0,0,0,0.65)',
  skeleton: '#1F1F22',
  ink: '#F4F2EE',
  onInk: '#0B0B0C',
};

export type Colors = typeof light;

/** 4-pt spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Bricolage Grotesque for headings (character), Inter for reading and numbers (clarity). */
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  sans: 'Inter_400Regular',
  sansItalic: 'Inter_400Regular_Italic',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
};

export const type = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  subheading: { fontFamily: fonts.sansSemibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 22 },
  reading: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 27 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.sansSemibold, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.sansSemibold, fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase' as const },
  number: { fontFamily: fonts.sansBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.3, fontVariant: ['tabular-nums' as const] },
};

export type TypeVariant = keyof typeof type;

/** Resolves the saved appearance choice (or the phone setting) to a palette. */
export function useTheme() {
  const scheme = useColorScheme();
  const mode = useAppearance((s) => s.mode);
  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  return { c: isDark ? dark : light, dark: isDark, space, radius, type, fonts };
}

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
