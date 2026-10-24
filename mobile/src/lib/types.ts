/** Shapes the API returns (see backend/src/routes). Dates arrive as ISO strings. */
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';

export interface SessionDto {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  capacity: number;
  booked: number;
  available: number;
  waitlistCount: number;
  room: string | null;
  classType: { id: string; name: string; nameEn: string | null; description: string; descriptionEn: string | null; format: string; difficulty: Difficulty; creditsRequired: number; imageKey: string | null };
  instructor: { id: string; name: string } | null;
  myBookingId: string | null;
  myWaitlist: { id: string; status: 'WAITING' | 'OFFERED'; offerExpiresAt: string | null; position: number | null } | null;
}

export interface SessionDetail extends SessionDto {
  instructorBio: string | null;
  myCredits: number;
  eligible: boolean;
  freeCancelUntil: string;
  lateCancelKeepsCredit: boolean;
  waitlistEnabled: boolean;
  bookable: boolean;
}

export interface Treatment {
  id: string;
  name: string;
  nameEn: string | null;
  category: string;
  description: string;
  descriptionEn: string | null;
  benefits: string;
  benefitsEn: string | null;
  durationMin: number;
  price: number;
  imageKey: string | null;
  clientCanChooseTherapist: boolean;
  active: boolean;
  therapists?: { id: string; name: string }[];
}

export interface Product {
  id: string;
  kind: 'SINGLE' | 'PACKAGE' | 'TRIAL' | 'PROMO' | 'DUO' | 'COMBO' | 'SPA';
  name: string;
  nameEn: string | null;
  description: string;
  descriptionEn: string | null;
  price: number;
  originalPrice: number | null;
  classCredits: number;
  validityDays: number;
  sessionsPerWeekHint: number | null;
  terms: string;
  termsEn: string | null;
  firstTimeOnly: boolean;
  imageKey: string | null;
  active: boolean;
  spaItems: { id: string; quantity: number; category: string | null; treatment: { id: string; name: string } | null }[];
}

export interface Slot {
  startsAt: string;
  time: string;
  therapists: { id: string; name: string }[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  createdAt: string;
  readAt: string | null;
}

/** Albanian is entered by the studio; English is optional and falls back to it. */
export const loc = (lang: 'sq' | 'en', sq: string, en?: string | null) => (lang === 'en' && en ? en : sq);
