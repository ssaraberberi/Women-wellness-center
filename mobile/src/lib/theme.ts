/* The website's palette, as the phone draws it: cream for the surface,
   wine for the brand and the actions, and the same wine driven nearly to
   black for the ink, so even the shadows stay in the studio's own hue. */
import { Platform } from 'react-native';

export const C = {
  cream: '#FFFBEA',
  sand: '#F5E9DC',
  wine: '#7D2F49',
  wineSoft: '#9B4A64',
  ink: '#3B1522',
  deep: '#2A0E18',
  muted: '#7A5A63',
  line: '#E8D8CB',
  white: '#FFFFFF',
  good: '#2F6B4A',
  goodBg: '#E3F0E7',
  warn: '#8A5A00',
  warnBg: '#FBEFD5',
  bad: '#A12A2A',
  badBg: '#F8E1DF'
};

/* Fraunces on the website; the phone's own serif here, which keeps the
   app free of a font download and still reads as the same voice. */
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export const R = { card: 14, control: 10, pill: 999 };
export const S = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
