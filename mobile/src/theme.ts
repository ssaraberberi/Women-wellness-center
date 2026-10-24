/** DUA — cream paper, wine ink, espresso type. Taken from the brand and the mockups. */
export const colors = {
  bg: '#F3ECE4',
  surface: '#FAF6F1',
  card: '#F7F1EA',
  sand: '#EADFD3',
  line: '#E4D8CC',
  wine: '#5E1F2D',
  wineDeep: '#43121F',
  wineSoft: '#F0E2E2',
  ink: '#2E1E1A',
  inkSoft: '#5E4B45',
  muted: '#8B776F',
  white: '#FFFFFF',
  success: '#3F6B4E',
  successSoft: '#E3EDE4',
  warning: '#8A5A12',
  warningSoft: '#F5E8CF',
  danger: '#9B2C2C',
  dangerSoft: '#F6E0DE',
  overlay: 'rgba(30, 14, 10, 0.38)',
} as const;

export const fonts = {
  display: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

/** Minimum touch target on both platforms. */
export const HIT = 44;
