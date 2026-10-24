/** The studio's photographs, by the imageKey the API stores on classes, treatments and packages. */
const photos = {
  hero: require('../../assets/photos/hero.jpg'),
  'reformer-room': require('../../assets/photos/reformer-room.jpg'),
  'reformer-evening': require('../../assets/photos/reformer-evening.jpg'),
  'studio-reformers': require('../../assets/photos/studio-reformers.jpg'),
  'studio-correction': require('../../assets/photos/studio-correction.jpg'),
  'mat-studio': require('../../assets/photos/mat-studio.jpg'),
  'massage-hands': require('../../assets/photos/massage-hands.jpg'),
  'recovery-wood': require('../../assets/photos/recovery-wood.jpg'),
  'treatment-corridor': require('../../assets/photos/treatment-corridor.jpg'),
} as const;

export type PhotoKey = keyof typeof photos;

export function photo(key: string | null | undefined, fallback: PhotoKey = 'studio-reformers') {
  return photos[(key ?? '') as PhotoKey] ?? photos[fallback];
}

export const logoLockup = require('../../assets/images/logo-lockup.png');
export const logoMark = require('../../assets/images/logo-mark.png');
