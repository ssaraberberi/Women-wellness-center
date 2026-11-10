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
      body: p.price
        ? L(l, `${p.className} · ${p.when}. Çmimi ${p.price}, paguan në studio me cash. Të presim!`, `${p.className} · ${p.when}. ${p.price}, paid at the studio in cash. See you there!`)
        : L(l, `${p.className} · ${p.when}. Të presim!`, `${p.className} · ${p.when}. See you there!`),
      details: [...classDetails(l, p), ...(p.price ? ([[L(l, 'Për të paguar', 'To pay'), String(p.price)]] as [string, string][]) : [])],
    }),
  },
  CLASS_CANCELLED: {
    category: 'essential',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Rezervimi u anulua', 'Booking cancelled'),
      body: p.refunded
        ? L(l, `${p.className} · ${p.when}. Seanca u kthye.`, `${p.className} · ${p.when}. Your session was returned.`)
        : L(l, `${p.className} · ${p.when}. Anulim i vonë — seanca llogaritet e harxhuar.`, `${p.className} · ${p.when}. Late cancellation — the session is used up.`),
      details: classDetails(l, p),
    }),
  },
  SESSION_CANCELLED: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, 'Klasa u anulua nga studio', 'Class cancelled by the studio'),
      body: L(l, `Na vjen keq: ${p.className} · ${p.when} nuk do zhvillohet. Seanca u kthye.`, `We're sorry: ${p.className} · ${p.when} will not take place. Your session was returned.`),
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
  // The client's three reminders before a class.
  CLASS_REMINDER_60: {
    category: 'reminders',
    email: false,
    render: (l, p) => ({
      title: L(l, 'A je gati për klasën tënde të Pilates sot?', 'Ready for your Pilates class today?'),
      body: L(l, `${p.className} fillon në ${p.time}. Shihemi së shpejti!`, `${p.className} starts at ${p.time}. See you soon!`),
    }),
  },
  CLASS_REMINDER_30: {
    category: 'reminders',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Nis e bëhu gati', 'Time to get ready'),
      body: L(l, `${p.className} fillon pas 30 minutash, në ${p.time}.`, `${p.className} starts in 30 minutes, at ${p.time}.`),
    }),
  },
  CLASS_REMINDER_15: {
    category: 'reminders',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Të presim në studio', 'We are expecting you'),
      body: L(
        l,
        `Të lutem të jesh në studio 10 minuta para se të nisë klasa (${p.className} · ${p.time}).`,
        `Please be at the studio 10 minutes before the class starts (${p.className} · ${p.time}).`,
      ),
    }),
  },

  // The instructor's day: who booked, and her own reminders.
  STAFF_NEW_BOOKING: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Rezervim i ri', 'New booking'),
      body: L(l, `${p.client} rezervoi ${p.className} · ${p.when} (${p.booked}/${p.capacity}).`, `${p.client} booked ${p.className} · ${p.when} (${p.booked}/${p.capacity}).`),
    }),
  },
  // To the instructor, by email too: who was added, and her whole day as it stands now.
  INSTRUCTOR_NEW_BOOKING: {
    category: 'essential',
    email: true,
    critical: true,
    render: (l, p) => ({
      title: L(l, `${p.client} u shtua në ${p.range}`, `${p.client} was added to ${p.range}`),
      body: L(l, `${p.client} u shtua në ${p.range}.\n\nJa ku është përmbledhja jote e ditës (${p.day}):`, `${p.client} was added to ${p.range}.\n\nHere is your day (${p.day}):`),
      details: String(p.summary ?? '')
        .split('\n')
        .filter(Boolean)
        .map((row) => row.split('\t') as [string, string]),
    }),
  },
  STAFF_BOOKING_CANCELLED: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Rezervim i anuluar', 'Booking cancelled'),
      body: L(
        l,
        `${p.client} anuloi ${p.className} · ${p.when}${p.late ? ' (vonë — seanca u harxhua)' : ''} (${p.booked}/${p.capacity}).`,
        `${p.client} cancelled ${p.className} · ${p.when}${p.late ? ' (late — the session is used up)' : ''} (${p.booked}/${p.capacity}).`,
      ),
    }),
  },
  INSTRUCTOR_REMINDER_120: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Ke klasë sot', 'You have a class today'),
      body: L(l, `${p.className} në ${p.time} · ${p.booked}/${p.capacity} të rezervuara.`, `${p.className} at ${p.time} · ${p.booked}/${p.capacity} booked.`),
    }),
  },
  INSTRUCTOR_REMINDER_60: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Klasa jote fillon për 1 orë', 'Your class starts in 1 hour'),
      body: L(l, `${p.className} në ${p.time} · ${p.booked}/${p.capacity} të rezervuara.`, `${p.className} at ${p.time} · ${p.booked}/${p.capacity} booked.`),
    }),
  },
  INSTRUCTOR_REMINDER_15: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Bëhu gati të nisësh klasën', 'Get ready to start your class'),
      body: L(l, `${p.className} fillon në ${p.time} · ${p.booked} pjesëmarrëse.`, `${p.className} starts at ${p.time} · ${p.booked} participants.`),
    }),
  },

  // What the admins hear about.
  ADMIN_NEW_CLIENT: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Kliente e re', 'New client'),
      body: L(l, `${p.client} u regjistrua në platformë${p.via ? ` (${p.via})` : ''}.`, `${p.client} signed up${p.via ? ` (${p.via})` : ''}.`),
    }),
  },
  ADMIN_NEW_ORDER: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Paketë e rezervuar', 'Package reserved'),
      body: L(l, `${p.client} rezervoi ${p.product} · ${p.total}. Pret pagesën në studio (ref. ${p.reference}).`, `${p.client} reserved ${p.product} · ${p.total}. Awaiting payment at the studio (ref. ${p.reference}).`),
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
  BONUS_GRANTED: {
    category: 'essential',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Një klasë bonus për ty', 'A bonus class for you'),
      body: L(l, `${p.offer}: ${p.n} klasë bonus u shtua në paketën tënde.`, `${p.offer}: ${p.n} bonus class(es) added to your package.`),
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
        [L(l, 'Seanca', 'Sessions'), String(p.credits)],
        [L(l, 'Skadon', 'Expires'), String(p.expires)],
      ],
    }),
  },
  MEMBERSHIP_EXPIRING: {
    category: 'reminders',
    email: true,
    render: (l, p) => ({
      title: L(l, 'Paketa po skadon', 'Your package is expiring'),
      body: L(l, `${p.product} skadon më ${p.expires}. Të kanë mbetur ${p.remaining} seanca.`, `${p.product} expires on ${p.expires}. ${p.remaining} sessions left.`),
    }),
  },
  CREDITS_ADJUSTED: {
    category: 'essential',
    email: false,
    render: (l, p) => ({
      title: L(l, 'Seancat u përditësuan', 'Sessions updated'),
      body: L(l, `${p.delta} seanca · ${p.reason ?? ''}`, `${p.delta} sessions · ${p.reason ?? ''}`),
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
