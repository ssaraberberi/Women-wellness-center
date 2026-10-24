/**
 * The words of every notification, in both languages. Params are already
 * formatted (dates in studio time) by the caller.
 */
type Lang = 'sq' | 'en';
type P = Record<string, string | number | undefined>;

export interface Message {
  title: string;
  body: string;
  details?: [string, string][];
}

type Def = {
  /** reminders / waitlist respect their own switch; essential always goes in-app. */
  category: 'essential' | 'reminders' | 'waitlist' | 'marketing';
  email: boolean;
  /** Sent by email even if the client switched email off: they must not miss it. */
  critical?: boolean;
  render: (lang: Lang, p: P) => Message;
};

const L = (lang: Lang, sq: string, en: string) => (lang === 'sq' ? sq : en);

const classDetails = (lang: Lang, p: P): [string, string][] => [
  [L(lang, 'Klasa', 'Class'), String(p.className)],
  [L(lang, 'Data', 'Date'), String(p.when)],
  ...(p.instructor ? ([[L(lang, 'Instruktorja', 'Instructor'), String(p.instructor)]] as [string, string][]) : []),
];

export const MESSAGES: Record<string, Def> = {
  CLASS_BOOKED: {
    category: 'essential',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Rezervimi u krye', 'Booking confirmed'),
      body: L(l, `${p.className} · ${p.when}. Të presim!`, `${p.className} · ${p.when}. See you there!`),
      details: classDetails(l, p),
    }),
  },
  CLASS_CANCELLED: {
    category: 'essential',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Rezervimi u anulua', 'Booking cancelled'),
      body: p.refunded
        ? L(l, `${p.className} · ${p.when}. Krediti u kthye.`, `${p.className} · ${p.when}. Your credit was returned.`)
        : L(l, `${p.className} · ${p.when}. Anulim i vonë — krediti nuk kthehet.`, `${p.className} · ${p.when}. Late cancellation — the credit is kept.`),
      details: classDetails(l, p),
    }),
  },
  SESSION_CANCELLED: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, 'Klasa u anulua nga studio', 'Class cancelled by the studio'),
      body: L(l, `Na vjen keq: ${p.className} · ${p.when} nuk do zhvillohet. Krediti u kthye.`, `We're sorry: ${p.className} · ${p.when} will not take place. Your credit was returned.`),
      details: classDetails(l, p),
    }),
  },
  SESSION_CHANGED: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, 'Ndryshim në orar', 'Schedule change'),
      body: L(l, `${p.className} tani është ${p.when}.`, `${p.className} is now ${p.when}.`),
      details: classDetails(l, p),
    }),
  },
  CLASS_REMINDER: {
    category: 'reminders',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Kujtesë për klasën', 'Class reminder'),
      body: L(l, `${p.className} · ${p.when}`, `${p.className} · ${p.when}`),
    }),
  },
  WAITLIST_OFFER: {
    category: 'waitlist',
    email: true,
    render: (l, p) => ({
      title: L(l, 'U lirua një vend!', 'A place opened up!'),
      body: L(
        l,
        `${p.className} · ${p.when}. Vendi të mbahet deri në ${p.until}. Konfirmoje në aplikacion.`,
        `${p.className} · ${p.when}. We hold it for you until ${p.until}. Confirm it in the app.`,
      ),
      details: classDetails(l, p),
    }),
  },
  WAITLIST_EXPIRED: {
    category: 'waitlist',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Oferta skadoi', 'Offer expired'),
      body: L(l, `Vendi në ${p.className} · ${p.when} kaloi te tjetra në listë.`, `The place in ${p.className} · ${p.when} went to the next person.`),
    }),
  },
  SPA_BOOKED: {
    category: 'essential',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Termini SPA u konfirmua', 'SPA appointment confirmed'),
      body: L(l, `${p.treatment} · ${p.when}`, `${p.treatment} · ${p.when}`),
      details: [
        [L(l, 'Trajtimi', 'Treatment'), String(p.treatment)],
        [L(l, 'Data', 'Date'), String(p.when)],
        [L(l, 'Terapistja', 'Therapist'), String(p.therapist)],
        [L(l, 'Dhoma', 'Room'), String(p.room)],
      ],
    }),
  },
  SPA_CANCELLED: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, 'Termini SPA u anulua', 'SPA appointment cancelled'),
      body: L(l, `${p.treatment} · ${p.when}`, `${p.treatment} · ${p.when}`),
    }),
  },
  SPA_RESCHEDULED: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, 'Termini SPA u zhvendos', 'SPA appointment moved'),
      body: L(l, `${p.treatment} tani është ${p.when}.`, `${p.treatment} is now ${p.when}.`),
    }),
  },
  SPA_REMINDER: {
    category: 'reminders',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Kujtesë SPA', 'SPA reminder'),
      body: L(l, `${p.treatment} · ${p.when}`, `${p.treatment} · ${p.when}`),
    }),
  },
  ORDER_PENDING: {
    category: 'essential',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Paketa u rezervua', 'Package reserved'),
      body: L(
        l,
        `${p.product} · ${p.total}. Paguaj në studio (ref. ${p.reference}) dhe paketa aktivizohet menjëherë.`,
        `${p.product} · ${p.total}. Pay at the studio (ref. ${p.reference}) and it is activated right away.`,
      ),
      details: [
        [L(l, 'Paketa', 'Package'), String(p.product)],
        [L(l, 'Totali', 'Total'), String(p.total)],
        [L(l, 'Referenca', 'Reference'), String(p.reference)],
      ],
    }),
  },
  PURCHASE_ACTIVE: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, 'Paketa është aktive', 'Your package is active'),
      body: L(l, `${p.product} · e vlefshme deri më ${p.expires}.`, `${p.product} · valid until ${p.expires}.`),
      details: [
        [L(l, 'Paketa', 'Package'), String(p.product)],
        [L(l, 'Kredite', 'Credits'), String(p.credits)],
        [L(l, 'Skadon', 'Expires'), String(p.expires)],
      ],
    }),
  },
  MEMBERSHIP_EXPIRING: {
    category: 'reminders',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Paketa po skadon', 'Your package is expiring'),
      body: L(l, `${p.product} skadon më ${p.expires}. Të kanë mbetur ${p.remaining} kredite.`, `${p.product} expires on ${p.expires}. ${p.remaining} credits left.`),
    }),
  },
  CREDITS_ADJUSTED: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Kreditet u përditësuan', 'Credits updated'),
      body: L(l, `${p.delta} kredite · ${p.reason ?? ''}`, `${p.delta} credits · ${p.reason ?? ''}`),
    }),
  },
  STAFF_INVITE: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, 'Ftesë nga DUA', 'Your DUA invitation'),
      body: L(
        l,
        `${p.inviter} të ftoi si ${p.roleName}. Shkarko aplikacionin DUA dhe hyr me këtë email (${p.email}) — do të marrësh një kod.`,
        `${p.inviter} invited you as ${p.roleName}. Open the DUA app and sign in with this email (${p.email}) — you will receive a code.`,
      ),
    }),
  },
  STAFF_ASSIGNED: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Seancë e re', 'New session assigned'),
      body: L(l, `${p.className} · ${p.when}`, `${p.className} · ${p.when}`),
    }),
  },
  STAFF_SESSION_CANCELLED: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Seanca u anulua', 'Session cancelled'),
      body: L(l, `${p.className} · ${p.when}`, `${p.className} · ${p.when}`),
    }),
  },
  STAFF_SCHEDULE_CHANGED: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Orari ndryshoi', 'Schedule changed'),
      body: L(l, `${p.className} · ${p.when}`, `${p.className} · ${p.when}`),
    }),
  },
  STAFF_REQUEST_REVIEWED: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: p.approved ? L(l, 'Kërkesa u miratua', 'Request approved') : L(l, 'Kërkesa u refuzua', 'Request declined'),
      body: String(p.summary ?? ''),
    }),
  },
  STAFF_REQUEST_NEW: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Kërkesë e re nga stafi', 'New staff request'),
      body: `${p.staff}: ${p.summary}`,
    }),
  },
  DIRECT: {
    category: 'essential',
    email: false,
    render: (_l, p) => ({ title: String(p.title), body: String(p.body) }),
  },
  ANNOUNCEMENT: {
    category: 'marketing',
    email: false,
    render: (_l, p) => ({ title: String(p.title), body: String(p.body) }),
  },
};
