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
  /** One class without a package, paid at the studio; null when no price is set up. */
  singlePrice: number | null;
  /** A DUO that comes together: who she books with, and what each has left. */
  duo: { partner: string; mine: number; theirs: number } | null;
}

/** The public timetable: the same classes, nothing about any person. */
export type PublicSession = Omit<SessionDto, 'myBookingId' | 'myWaitlist'>;

export interface CatalogueProduct {
  id: string;
  kind: Product['kind'];
  name: string;
  nameEn: string | null;
  description: string;
  descriptionEn: string | null;
  price: number;
  originalPrice: number | null;
  classCredits: number;
  validityDays: number;
  persons: number;
  firstTimeOnly: boolean;
  terms: string;
  termsEn: string | null;
}

export interface LiveOffer {
  id: string;
  kind: 'BUNDLE' | 'DISCOUNT' | 'BONUS';
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  discountPct: number | null;
  endsOn: string | null;
  left: number | null;
  newClientsOnly: boolean;
  friendRequired: boolean;
  bonusClasses: number;
  together: boolean;
  product: CatalogueProduct | null;
  eligibleProductIds: string[];
}

export interface Catalogue {
  products: CatalogueProduct[];
  offers: LiveOffer[];
}

/** The website's rule for an offer's price: the percentage off, rounded to the lek. */
export const offerPrice = (price: number, offer: { kind: string; discountPct: number | null } | null | undefined) =>
  offer?.kind === 'DISCOUNT' && offer.discountPct ? Math.round((price * (100 - offer.discountPct)) / 100) : price;

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
  /** 2 for a DUO: one order, a package for each of the two. */
  persons: number;
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
