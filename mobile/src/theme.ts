/**
 * DUA — Scandinavian calm with a soft, feminine warmth: linen paper, white
 * surfaces that float on a whisper of shadow, wine ink and a blush accent.
 */
export const colors = {
  bg: '#F8F4EF',
  surface: '#FFFDFA',
  card: '#F4EEE7',
  sand: '#ECE3D8',
  oat: '#E6DACB',
  line: '#ECE4DA',
  wine: '#5E1F2D',
  wineDeep: '#43121F',
  wineSoft: '#F3E6E4',
  blush: '#F4E3DF',
  blushDeep: '#E6C9C2',
  ink: '#2B211E',
  inkSoft: '#6B5B55',
  muted: '#A0908A',
  white: '#FFFFFF',
  success: '#4E7559',
  successSoft: '#E6EFE7',
  warning: '#8A5A12',
  warningSoft: '#F6EBD6',
  danger: '#9B2C2C',
  dangerSoft: '#F7E3E1',
  overlay: 'rgba(30, 14, 10, 0.38)',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30, xxxl: 44 } as const;
export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/** The one shadow everything floats on: warm, wide and barely there. */
export const shadow = {
  shadowColor: '#4A2A22',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/** Minimum touch target on both platforms. */
export const HIT = 44;
