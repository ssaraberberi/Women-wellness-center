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
  'Most popular': 'Më e përzgjedhura',
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
  /* What shared/rules.js says, the statuses it names, and the small
     words the admin screens print raw. All of it reaches the page
     through el(), so it only needed to be written down. */
  'Already booked': 'Tashmë e rezervuar',
  'Class is full': 'Klasa është plot',
  'No active membership': 'Pa abonim aktiv',
  'No longer at the studio': 'Nuk është më në studio',
  'Not at the studio': 'Jo në studio',
  'Not included in your membership': 'Nuk përfshihet në abonimin tënd',
  'Outside their availability': 'Jashtë disponueshmërisë së saj',
  'Qualified and free': 'E kualifikuar dhe e lirë',
  'Sign in to book': 'Hyr për të rezervuar',
  'That class no longer exists': 'Ajo klasë nuk ekziston më',
  'This class has already started': 'Kjo klasë ka filluar tashmë',
  'This class was cancelled': 'Kjo klasë u anulua',
  'Waiting for the studio to confirm your package': 'Në pritje që studioja të konfirmojë paketën',
  'Your membership has expired': 'Abonimi yt ka skaduar',
  'recommended': 'e rekomanduar',
  'unavailable': 'e zënë',
  'unqualified': 'e pakualifikuar',
  'removed': 'e hequr',
  'cancelled': 'anuluar',
  'replaced': 'zëvendësuar',
  'requested': 'në pritje',
  'day': 'ditë',
  'week': 'javë',
  'month': 'muaj',
  'no limit': 'pa limit',
  'none set': 'pa caktuar',
  'Previous': 'E mëparshme',
  'mon': 'hën',
  'tue': 'mar',
  'wed': 'mër',
  'thu': 'enj',
  'fri': 'pre',
  'sat': 'sht',
  'sun': 'die',
  /* What the server says when it refuses. These arrive already
     written and reach the screen through toast(), so they are looked
     up like anything else. */
  'Sign in first': 'Hyr së pari',
  'Not allowed': 'Nuk lejohet',
  'Method not allowed': 'Metodë e palejuar',
  'No such endpoint': 'Nuk ka një adresë të tillë',
  'Request came from somewhere else': 'Kërkesa erdhi nga diku tjetër',
  'Request too large': 'Kërkesa është shumë e madhe',
  'Invalid JSON': 'JSON i pavlefshëm',
  'Email or password is wrong': 'Email-i ose fjalëkalimi është i gabuar',
  'This account has been removed': 'Kjo llogari është hequr',
  'That account has been removed': 'Ajo llogari është hequr',
  'Too many attempts. Wait a few minutes and try again.':
    'Shumë përpjekje. Prit pak minuta dhe provo sërish.',
  'That admin code is not valid': 'Ai kod administratoreje nuk është i vlefshëm',
  'That email already has an account': 'Ai email ka tashmë një llogari',
  'Password must be at least 8 characters': 'Fjalëkalimi duhet të ketë të paktën 8 shenja',
  'Already booked': 'Tashmë e rezervuar',
  'Already on this class': 'Tashmë në këtë klasë',
  'Booking not found': 'Rezervimi nuk u gjet',
  'That booking is not active': 'Ai rezervim nuk është aktiv',
  'No such class': 'Nuk ka një klasë të tillë',
  'No such instructor': 'Nuk ka një instruktore të tillë',
  'No such membership': 'Nuk ka një abonim të tillë',
  'No such package': 'Nuk ka një paketë të tillë',
  'No such person': 'Nuk ka një person të tillë',
  'That request is not waiting any more': 'Ajo kërkesë nuk është më në pritje',
  'A package has to allow something': 'Një paketë duhet të lejojë diçka',
  'A package with that name already exists': 'Një paketë me atë emër ekziston tashmë',
  'A line counts per week or per month': 'Një rresht numërohet në javë ose në muaj',
  'A limit is a whole number of classes, or blank for no limit':
    'Limiti është numër i plotë klasash, ose bosh për pa limit',
  'Every line needs at least one class type': 'Çdo rresht kërkon të paktën një lloj klase',
  'Price must be a whole number of lek': 'Çmimi duhet të jetë numër i plotë lekësh',
  'That name has no letters or digits in it': 'Ai emër nuk ka as shkronja as shifra',
  'The class must end after it starts': 'Klasa duhet të mbarojë pasi të ketë filluar',
  'Start must be before end': 'Fillimi duhet të jetë para mbarimit',
  'showPrices is true or false': 'showPrices është true ose false',
  'No instructor assigned': 'Pa instruktore të caktuar',
  'Reset password': 'Rivendos fjalëkalimin',
  'Make a new password': 'Krijo fjalëkalim të ri',
  'Done': 'U krye',
  'A new password is made now, shown once, and never shown again. Read it out, and tell her to change it after she signs in.':
    'Një fjalëkalim i ri krijohet tani, shfaqet një herë, dhe nuk shfaqet më. Lexoja me zë, dhe thuaji ta ndryshojë pasi të hyjë.',
  'Everywhere that account is signed in is signed out.':
    'Kudo ku ajo llogari është e kyçur, dilet.',
  'Write it down before you close this. It is not kept anywhere you can read it back.':
    'Shënoje para se ta mbyllësh. Nuk ruhet askund ku të lexohet përsëri.',
  'A client applies in the app and pays here at the studio. Confirm it only once she has paid — confirming is what makes it active, for thirty days from that day. Until then she cannot book.':
    'Një kliente aplikon në aplikacion dhe paguan këtu në studio. Konfirmoje vetëm pasi të ketë paguar — konfirmimi është ai që e bën aktive, për tridhjetë ditë nga ajo ditë. Deri atëherë nuk rezervon dot.',
  'Off, the website and a client signed in here both list every package and what it includes, and say the price is coming soon. The price is not sent to them at all. You always see it.':
    'Me të fikur, faqja dhe një kliente e kyçur këtu listojnë çdo paketë dhe çfarë përfshin, dhe thonë se çmimi vjen së shpejti. Çmimi nuk u dërgohet fare. Ti e sheh gjithmonë.',
  'Unknown client': 'Kliente e panjohur',

  /* The role as the server spells it, for the line under the logo. */
  'admin': 'administratore',
  'instructor': 'instruktore',
  'client': 'kliente',

  /* Written in scripts/data.sql rather than here, but the studio is
     bilingual and a client should not meet English in the middle of her
     own language. Change a blurb there and add its pair here. */
  'Total relaxation. One hour.': 'Relaks total. Një orë.',
  'Lightness and recovery. One hour.': 'Lehtësi dhe rikuperim. Një orë.',
  'Firming and body care. One hour.': 'Fortësim dhe kujdes trupor. Një orë.',
  'Release and restore. One hour.': 'Lirim dhe rikthim. Një orë.',
  'The full DUA experience. Ninety minutes.': 'Eksperienca e plotë DUA. Nëntëdhjetë minuta.',
  'Three relax hours.': 'Tri orë relaksi.',
  'Five lymphatic hours.': 'Pesë orë limfatike.',
  'Five sculpt hours.': 'Pesë orë sculpt.',
  'Four classes and one massage.': 'Katër klasa dhe një masazh.',
  'Eight classes and two massages.': 'Tetë klasa dhe dy masazhe.',
  'Eight classes and four sculpt hours.': 'Tetë klasa dhe katër orë sculpt.',
  'Twelve classes and four lymphatic hours.': 'Dymbëdhjetë klasa dhe katër orë limfatike.',
  'Eight classes and two lymphatic hours.': 'Tetë klasa dhe dy orë limfatike.',
  'One class and one massage.': 'Një klasë dhe një masazh.',
  'For two: a class and a massage each. Ask at the studio.':
    'Për dy: nga një klasë dhe një masazh secila. Pyet në studio.',
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
  'Reset the password for %s': 'Rivendos fjalëkalimin për %s',
  'New password for %s': 'Fjalëkalimi i ri për %s',
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
  '%s at the studio': '%s në studio',
  'Membership expired with %s classes still booked':
    'Abonimi skadoi me %s klasa ende të rezervuara',
  'Membership expired with %s class still booked':
    'Abonimi skadoi me %s klasë ende të rezervuar',
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
/* Sentences the rules build with a value inside them. Matching the shape
   beats listing one entry per number or per class type. */
const SHAPES = [
  [/^Booking opens (\d+) days ahead$/,            (m) => 'Rezervimi hapet ' + m[1] + ' ditë përpara'],
  [/^Does not teach (.+)$/,                        (m) => 'Nuk jep ' + m[1]],
  [/^Already teaching (.+)$/,                      (m) => 'Tashmë jep ' + m[1]],
  [/^No (.+) classes left this (week|month)$/,     (m) => 'Nuk ka më klasa ' + m[1] + ' këtë ' + (m[2] === 'week' ? 'javë' : 'muaj')],
  [/^Missing (.+)$/,                               (m) => 'Mungon ' + m[1]],
  [/^No such class type: (.+)$/,                   (m) => 'Nuk ka lloj klase: ' + m[1]],
  [/^You have already asked for (.+)\. The studio will confirm it once you have paid\.$/,
                                                   (m) => 'Ke kërkuar tashmë ' + m[1] + '. Studioja do ta konfirmojë sapo të kesh paguar.'],
  [/^(\d+) spots? left$/,                          (m) => m[1] === '1' ? '1 vend i lirë' : m[1] + ' vende të lira'],
];

export function t(s, ...args) {
  if (s == null) return s;
  const key = String(s);
  if (!args.length) {
    if (lang === 'en') return key;
    if (SQ[key] !== undefined) return SQ[key];
    for (const [re, to] of SHAPES) { const m = key.match(re); if (m) return to(m); }
    return key;
  }
  const tpl = lang === 'en' ? key : (SQ_FMT[key] !== undefined ? SQ_FMT[key] : key);
  /* %1 %2 %3 when a language needs the values in another order, %s when it
     does not. The English keys use %s; a translation may use either. */
  if (/%\d/.test(tpl)) return tpl.replace(/%(\d)/g, (_, n) => String(args[n - 1]));
  let i = 0;
  return tpl.replace(/%s/g, () => String(args[i++]));
}

/* A bare word used inside a formatted sentence — 'month', 'week'. */
export const tw = w => (lang === 'en' ? w : (SQ_FMT[w] !== undefined ? SQ_FMT[w] : w));
