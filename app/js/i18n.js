/* ============================================================
   DUA — the app in Albanian and English
   ------------------------------------------------------------
   Real translation rather than a pass over the DOM: el() sends every
   `text` and every human-readable attribute through t(), so a view says
   what it means in English and the right language comes out.

   Strings the server composes — a notice, an error — arrive already
   written and are looked up the same way; one that is missing comes
   through as it was, which is the right failure.

   t('Apply for %s', name) is how a sentence with a value in it is built.
   Never concatenate around t(): word order is not the same in both.
   ============================================================ */

const SQ = {
  /* ---- chrome ---- */
  'Dashboard': 'Paneli',
  'Schedule': 'Orari',
  'Instructors': 'Instruktoret',
  'Packages': 'Paketat',
  'Memberships': 'Abonimet',
  'Membership': 'Abonimi',
  'Clients': 'Klientet',
  'Client': 'Kliente',
  'Attention': 'Kujdes',
  'Needs attention': 'Kërkon kujdes',
  'Sections': 'Seksionet',
  'Sign out': 'Dil',
  'Sign in': 'Hyr',
  'Sign in to DUA': 'Hyr në DUA',
  'Create account': 'Krijo llogari',
  'Studio account': 'Llogaria e studios',
  'Dismiss': 'Mbylle',
  'Close': 'Mbyll',
  'Back': 'Kthehu',
  'Cancel': 'Anulo',
  'Save': 'Ruaj',
  'Save changes': 'Ruaj ndryshimet',
  'Edit': 'Ndrysho',
  'Remove': 'Hiq',
  'Review': 'Shiko',
  'Fix': 'Rregullo',
  'Keep': 'Lëre',
  'Keep it': 'Lëre ashtu',
  'Try again': 'Provo sërish',
  'Next': 'Tjetra',
  'Previous': 'E mëparshme',
  'Today': 'Sot',
  'Tomorrow': 'Nesër',
  'None': 'Asnjë',
  'Loading…': 'Po ngarkohet…',
  'One moment…': 'Një moment…',
  'Something went wrong': 'Diçka shkoi keq',
  'Cannot reach the studio': 'Nuk arrihet studioja',
  'Welcome back': 'Mirë se u ktheve',
  'Welcome to DUA': 'Mirë se erdhe në DUA',
  'Decide later': 'Vendos më vonë',

  /* ---- sign in ---- */
  'Full name': 'Emri i plotë',
  'Email': 'Email',
  'Phone': 'Telefoni',
  'Password': 'Fjalëkalimi',
  'Temporary password': 'Fjalëkalim i përkohshëm',
  'They can change it later.': 'Mund ta ndryshojë më vonë.',
  'Admin registration code': 'Kodi i regjistrimit si administratore',
  'Register as administrator': 'Regjistrohu si administratore',
  'Issued by the studio, and checked on the server.': 'Jepet nga studioja dhe kontrollohet në server.',
  'Administrator account created': 'Llogaria e administratores u krijua',

  /* ---- days and months ---- */
  'Monday': 'E hënë', 'Tuesday': 'E martë', 'Wednesday': 'E mërkurë', 'Thursday': 'E enjte',
  'Friday': 'E premte', 'Saturday': 'E shtunë', 'Sunday': 'E diel',
  'January': 'Janar', 'February': 'Shkurt', 'March': 'Mars', 'April': 'Prill',
  'May': 'Maj', 'June': 'Qershor', 'July': 'Korrik', 'August': 'Gusht',
  'September': 'Shtator', 'October': 'Tetor', 'November': 'Nëntor', 'December': 'Dhjetor',
  'Mon': 'Hën', 'Tue': 'Mar', 'Wed': 'Mër', 'Thu': 'Enj', 'Fri': 'Pre', 'Sat': 'Sht', 'Sun': 'Die',

  /* ---- client ---- */
  'Book a class': 'Rezervo një klasë',
  'Book class': 'Rezervo klasën',
  'Book another': 'Rezervo një tjetër',
  'Browse classes': 'Shfleto klasat',
  'My classes': 'Klasat e mia',
  'My schedule': 'Orari im',
  'Upcoming': 'Në vijim',
  'History': 'Historiku',
  'Next up': 'Në radhë',
  'Attended': 'Marrë pjesë',
  'Booked': 'Rezervuar',
  'Booked — see you there': 'Rezervuar — shihemi atje',
  'Cancelled': 'Anuluar',
  'Cancelled — session returned': 'Anuluar — seanca u kthye',
  'Cancelled — the session stays deducted': 'Anuluar — seanca mbetet e zbritur',
  'Late cancel': 'Anulim i vonë',
  'Cancel anyway': 'Anulo gjithsesi',
  'Join waitlist': 'Hyr në listën e pritjes',
  'On waitlist': 'Në listën e pritjes',
  'You are on the waitlist': 'Je në listën e pritjes',
  'Waitlist': 'Lista e pritjes',
  'Full': 'Plot',
  'Available': 'E lirë',
  'Not available': 'Jo e disponueshme',
  'Class cancelled': 'Klasa u anulua',
  'Nothing booked yet.': 'Asgjë e rezervuar ende.',
  'Nothing booked.': 'Asgjë e rezervuar.',
  'Nothing yet.': 'Asgjë ende.',
  'No classes scheduled.': 'Asnjë klasë në orar.',
  'No membership': 'Pa abonim',
  'Pick a membership to start booking': 'Zgjidh një abonim që të nisësh rezervimet',
  'Choose what fits your week': 'Zgjidh atë që i përshtatet javës sate',
  'View memberships': 'Shiko abonimet',
  'Your membership': 'Abonimi yt',
  'Current plan': 'Paketa aktuale',
  'Most chosen': 'Më e zgjedhura',
  'Price coming soon': 'Çmimi së shpejti',
  'To be confirmed': 'Në pritje të konfirmimit',
  'Expired': 'Skaduar',
  'Active': 'Aktive',

  /* ---- applying for a package ---- */
  'You are applying for': 'Po aplikon për',
  'How this works': 'Si funksionon',
  'Apply': 'Apliko',
  'Applied for another': 'Aplikuar për një tjetër',
  'Waiting for the studio': 'Në pritje të studios',
  'Waiting to be paid': 'Në pritje të pagesës',
  'You apply here. Nothing is charged and nothing is booked yet.':
    'Aplikon këtu. Nuk paguhet asgjë dhe nuk rezervohet asgjë ende.',
  'You pay at the studio.': 'Paguan në studio.',
  'We confirm it, and it becomes active for thirty days from that day — not from today.':
    'Ne e konfirmojmë, dhe bëhet aktive për tridhjetë ditë nga ajo ditë — jo nga sot.',
  'You apply here and pay at the studio. We confirm it there, and it runs for thirty days from that day.':
    'Aplikon këtu dhe paguan në studio. E konfirmojmë atje, dhe zgjat tridhjetë ditë nga ajo ditë.',
  'Nobody is waiting': 'Askush nuk është në pritje',
  'Paid — confirm': 'Pagoi — konfirmo',
  'Not paid': 'Nuk pagoi',
  'She has paid — confirm': 'Ka paguar — konfirmo',
  'Close it': 'Mbylle',
  'Close the application': 'Mbyll aplikimin',
  'Application closed': 'Aplikimi u mbyll',
  'She can apply again afterwards.': 'Mund të aplikojë sërish më pas.',
  'Do not confirm before the money is in. This is the only step that checks it.':
    'Mos konfirmo para se të kenë hyrë paratë. Ky është i vetmi hap që e kontrollon.',

  /* ---- instructor ---- */
  'Instructor': 'Instruktore',
  'My availability': 'Disponueshmëria ime',
  'What I teach': 'Çfarë jap',
  'Teaches': 'Jep',
  'Qualified for': 'E kualifikuar për',
  'Qualified to teach': 'E kualifikuar të japë',
  'Working days': 'Ditët e punës',
  'Available from': 'E lirë nga',
  'Until': 'Deri',
  'Starts': 'Fillon',
  'Ends': 'Mbaron',
  'Outside your hours': 'Jashtë orarit tënd',
  'Your assigned classes': 'Klasat e tua të caktuara',
  'The classes you are qualified and willing to take': 'Klasat që je e kualifikuar dhe e gatshme të marrësh',
  'Tick what you are happy to teach. The studio can only place you in these classes.':
    'Shëno çfarë je e gatshme të japësh. Studioja mund të të vendosë vetëm në këto klasa.',
  'The studio only offers you classes inside these hours':
    'Studioja të ofron klasa vetëm brenda këtyre orareve',
  'A class is only offered to you if it fits entirely inside one of these windows.':
    'Një klasë të ofrohet vetëm nëse hyn e gjitha brenda njërës prej këtyre dritareve.',
  'No classes assigned yet. The studio will place you once your availability is set.':
    'Ende pa klasa të caktuara. Studioja do të të vendosë sapo të caktosh disponueshmërinë.',

  /* ---- admin: schedule ---- */
  'Add class': 'Shto klasë',
  'Add a class': 'Shto një klasë',
  'Edit class': 'Ndrysho klasën',
  'Class added': 'Klasa u shtua',
  'Class updated': 'Klasa u përditësua',
  'Cancel class': 'Anulo klasën',
  'Cancel this class': 'Anulo këtë klasë',
  'Cancel this class?': 'Të anulohet kjo klasë?',
  'Create, move and staff the timetable': 'Krijo, zhvendos dhe cakto instruktore në orar',
  'Class': 'Klasa',
  'Classes': 'Klasat',
  'Classes this week': 'Klasat këtë javë',
  "Today's classes": 'Klasat e sotme',
  'Nothing scheduled today.': 'Asgjë në orar sot.',
  'Next 7 days': '7 ditët e ardhshme',
  'Date': 'Data',
  'When': 'Kur',
  'Capacity': 'Kapaciteti',
  'Status': 'Statusi',
  'Who booked': 'Kush rezervoi',
  'Who teaches this class?': 'Kush e jep këtë klasë?',
  'Assign instructor': 'Cakto instruktore',
  'Unassigned': 'Pa instruktore',
  'Recommended': 'E rekomanduar',
  'Nobody qualified is free at this time.': 'Asnjë e kualifikuar nuk është e lirë në këtë orë.',
  'Nobody yet.': 'Askush ende.',
  'Checked against qualifications, availability and clashes when you save.':
    'Kontrollohet kundrejt kualifikimeve, disponueshmërisë dhe përplasjeve kur ruan.',
  'Start must be before end': 'Fillimi duhet të jetë para mbarimit',
  'The class must end after it starts': 'Klasa duhet të mbarojë pasi të ketë filluar',
  'Remove instructor': 'Hiq instruktoren',
  'Remove instructor from this class': 'Hiq instruktoren nga kjo klasë',
  'Add instructor': 'Shto instruktore',
  'Add an instructor': 'Shto një instruktore',
  'Instructor added — they can sign in now': 'Instruktorja u shtua — mund të hyjë tani',
  'Pick at least one class they can teach': 'Zgjidh të paktën një klasë që mund ta japë',
  'They lose access to the instructor dashboard straight away.':
    'E humbet aksesin te paneli i instruktores menjëherë.',
  'Things that were valid when they were set, and are not now':
    'Gjëra që ishin në rregull kur u caktuan, dhe nuk janë më',
  'Nothing to fix. Every class has an instructor who is qualified and free.':
    'Asgjë për të rregulluar. Çdo klasë ka një instruktore të kualifikuar dhe të lirë.',

  /* ---- admin: packages and memberships ---- */
  'Add package': 'Shto paketë',
  'New package': 'Paketë e re',
  'Package': 'Paketa',
  'Package added — clients see it now': 'Paketa u shtua — klientet e shohin tani',
  'Package updated': 'Paketa u përditësua',
  'No packages yet. Add one and it appears to clients straight away.':
    'Ende pa paketa. Shto një dhe u shfaqet klienteve menjëherë.',
  'What the studio sells, and what each one lets you book':
    'Çfarë shet studioja, dhe çfarë lejon secila të rezervosh',
  'What it allows': 'Çfarë lejon',
  'Add a line': 'Shto një rresht',
  'On it now': 'Aktualisht me të',
  'Price': 'Çmimi',
  'In lek, whole numbers': 'Në lekë, numra të plotë',
  'Order': 'Radha',
  'Lowest first': 'Më i vogli i pari',
  'Line underneath': 'Rreshti poshtë',
  'Name': 'Emri',
  'Per': 'Për',
  'Unlimited': 'Pa limit',
  'Show as the most popular package': 'Shfaqe si paketën më të zgjedhur',
  'Show prices to clients': 'Trego çmimet te klientet',
  'Prices are on the website now': 'Çmimet janë në faqe tani',
  'Prices are hidden on the website': 'Çmimet janë të fshehura në faqe',
  'Retire': 'Tërhiq',
  'Retire it': 'Tërhiqe',
  'Nothing is deleted. The package stays on every membership that already names it.':
    'Nuk fshihet asgjë. Paketa mbetet në çdo abonim që e përmend tashmë.',
  'Plan': 'Paketa',
  'Adjust': 'Rregullo',
  'Expires': 'Skadon',
  'Usage this month': 'Përdorimi këtë muaj',
  'Active memberships': 'Abonime aktive',
  'Cancelled bookings': 'Rezervime të anuluara',
  'Membership updated — the client sees it now': 'Abonimi u përditësua — klientja e sheh tani',
  'Extending the date or changing the plan takes effect immediately, including for classes already booked.':
    'Zgjatja e datës ose ndryshimi i paketës hyn në fuqi menjëherë, edhe për klasat e rezervuara tashmë.',
  'Unknown client': 'Kliente e panjohur',

  /* The role as the server spells it, for the line under the logo. */
  'admin': 'administratore',
  'instructor': 'instruktore',
  'client': 'kliente',

  /* Written in scripts/data.sql rather than here, but the studio is
     bilingual and a client should not meet English in the middle of her
     own language. Change a blurb there and add its pair here. */
  'Meet DUA. One reformer class, for new clients, once.':
    'Provo DUA. Një klasë reformeri, për kliente të reja, një herë.',
  'Your class, your time. One reformer class, no package.':
    'Një klasë, kur të duash. Një klasë reformeri, pa paketë.',
  'Build the habit. Four classes, around once a week.':
    'Fillo rutinën. Katër klasa, afërsisht një herë në javë.',
  'The sweet spot. Eight classes, around twice a week.':
    'Rutina ideale. Tetë klasa, afërsisht dy herë në javë.',
  'Take it further. Twelve classes, around three a week.':
    'Bëje pjesë të rutinës. Dymbëdhjetë klasa, afërsisht tri herë në javë.',
  'For the Pilates girls. Sixteen classes, four a week.':
    'Për Pilates girls. Gjashtëmbëdhjetë klasa, katër herë në javë.',

  /* The notices the server writes. Same reason. */
  'Your calendar is open.': 'Kalendari yt është i hapur.'
};

/* Sentences with a value in them. The English is the key, %s is where the
   value goes, and the Albanian may put it somewhere else entirely. */
const SQ_FMT = {
  'Apply for %s': 'Apliko për %s',
  'Applied for %s': 'Aplikuar për %s',
  'Confirm %s': 'Konfirmo %s',
  'Edit %s': 'Ndrysho %s',
  'Adjust %s': 'Rregullo %s',
  'Retire %s': 'Tërhiq %s',
  'Remove %s': 'Hiq %s',
  'Added %s': '%s u shtua',
  'Removed %s': '%s u hoq',
  'Renews %s': 'Rinovohet më %s',
  'Expired %s': 'Skaduar më %s',
  'Nothing on %s': 'Asgjë më %s',
  'Free cancellation until %s': 'Anulim falas deri në %s',
  'The next %s': '%s në vijim',
  'Unlimited %s': '%s pa limit',
  /* Albanian puts the day before the month, so this one reorders: %1 is
     the weekday, %2 the month, %3 the date. */
  '%s, %s %s': '%1, %3 %2',
  '%s a %s': '%s në %s',
  '%s %s a %s': '%s %s në %s',
  '%s left this %s': '%s të mbetura këtë %s',
  '%s of %s': '%s nga %s',
  '%s seats booked': '%s vende të rezervuara',
  '%s free': '%s të lira',
  '%s classes': '%s klasa',
  '%s upcoming class': '%s klasë në vijim',
  '%s client is waiting': '%s kliente në pritje',
  '%s clients are waiting': '%s kliente në pritje',
  'No one is on %s.': 'Askush nuk është me %s.',
  '%s is active for %s': '%s është aktive për %s',
  '%s classes need attention': '%s klasa kërkojnë kujdes',
  '%s class needs attention': '%s klasë kërkon kujdes',
  '%s assigned': '%s u caktua',
  '%s — %s': '%s — %s',
  '%s people are already booked; capacity cannot go below that':
    '%s persona janë rezervuar tashmë; kapaciteti nuk zbret dot nën këtë',
  'Class cancelled — %s clients notified and refunded':
    'Klasa u anulua — %s kliente u njoftuan dhe iu kthye seanca',
  'Class cancelled — %s client notified and refunded':
    'Klasa u anulua — %s kliente u njoftua dhe iu kthye seanca',
  'Remove %s?': 'Të hiqet %s?',
  '%s upcoming classes will be left unassigned. Bookings are kept, and those clients are told a new instructor is coming.':
    '%s klasa të ardhshme mbeten pa instruktore. Rezervimet ruhen, dhe ato kliente njoftohen se po vjen një instruktore e re.',
  '%s upcoming class will be left unassigned. Bookings are kept, and those clients are told a new instructor is coming.':
    '%s klasë e ardhshme mbetet pa instruktore. Rezervimet ruhen, dhe ato kliente njoftohen se po vjen një instruktore e re.',
  'Removed — %s classes now need an instructor': 'U hoq — %s klasa tani kërkojnë instruktore',
  'Removed — %s class now needs an instructor': 'U hoq — %s klasë tani kërkon instruktore',
  'Unlimited %s per %s': '%s pa limit në %s',
  '%s × %s per %s': '%s × %s në %s',
  '%s client is on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.':
    '%s kliente e ka %s tani. E mban derisa t\'i mbarojë — tërheqja vetëm ndalon blerje të reja.',
  '%s clients are on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.':
    '%s kliente e kanë %s tani. E mbajnë derisa t\'u mbarojë — tërheqja vetëm ndalon blerje të reja.',
  '%s retired': '%s u tërhoq',
  'asked %s': 'kërkoi më %s',
  '%s has paid for %s at the studio. Confirming makes it active for thirty days from today, and opens her calendar straight away.':
    '%s ka paguar për %s në studio. Konfirmimi e bën aktive për tridhjetë ditë nga sot, dhe i hap kalendarin menjëherë.',
  '%s has not paid for %s. The application is closed and she is told to ask at the studio. She can apply again afterwards.':
    '%s nuk ka paguar për %s. Aplikimi mbyllet dhe asaj i thuhet të pyesë në studio. Mund të aplikojë sërish më pas.',
  'The next %s days': '%s ditët e ardhshme',
  '%s at DUA': '%s në DUA',
  'Free cancellation until %s. Your session goes straight back to your balance.':
    'Anulim falas deri në %s. Seanca të kthehet menjëherë në bilanc.',
  'The %s deadline has passed. This class will still count against your membership.':
    'Afati i %s ka kaluar. Kjo klasë do të zbritet gjithsesi nga abonimi yt.',
  'You applied for %s. Pay at the studio and we will confirm it — it becomes active for thirty days from the day we do, and your calendar opens then. Nothing has been charged here.':
    'Ke aplikuar për %s. Paguaj në studio dhe ne e konfirmojmë — bëhet aktive për tridhjetë ditë nga dita që e bëjmë, dhe kalendari të hapet atëherë. Këtu nuk është paguar asgjë.',
  ' or ': ' ose ',
  'a package': 'një paketë',
  'membership': 'abonim',
  '⚠ unassigned': '⚠ pa instruktore',
  'month': 'muaj',
  'week': 'javë'
};

let lang = 'sq';
const subs = new Set();

export function getLang() { return lang; }
export function onLang(fn) { subs.add(fn); return () => subs.delete(fn); }

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'sq';
  try { localStorage.setItem('dua-app-lang', lang); } catch (e) {}
  document.documentElement.lang = lang;
  subs.forEach(fn => fn(lang));
}

try {
  const saved = localStorage.getItem('dua-app-lang');
  lang = saved === 'en' ? 'en' : 'sq';
} catch (e) {}
document.documentElement.lang = lang;

/* The whole of it. A string with no entry comes through unchanged, which
   is how a name, a number or a word we have not met yet survives. */
export function t(s, ...args) {
  if (s == null) return s;
  const key = String(s);
  if (!args.length) return lang === 'en' ? key : (SQ[key] !== undefined ? SQ[key] : key);
  const tpl = lang === 'en' ? key : (SQ_FMT[key] !== undefined ? SQ_FMT[key] : key);
  /* %1 %2 %3 when a language needs the values in another order, %s when it
     does not. The English keys use %s; a translation may use either. */
  if (/%\d/.test(tpl)) return tpl.replace(/%(\d)/g, (_, n) => String(args[n - 1]));
  let i = 0;
  return tpl.replace(/%s/g, () => String(args[i++]));
}

/* A bare word used inside a formatted sentence — 'month', 'week'. */
export const tw = w => (lang === 'en' ? w : (SQ_FMT[w] !== undefined ? SQ_FMT[w] : w));
