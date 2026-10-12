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

  /* ---- the way back in ---- */
  'Forgot your password?': 'Harrove fjalëkalimin?',
  'Send me a link': 'Dërgomë një link',
  'Back to sign in': 'Kthehu te hyrja',
  'Give us the address you signed up with and we will send you a link to set a new password.':
    'Shkruaj adresën me të cilën u regjistrove dhe do të dërgojmë një link për të vendosur fjalëkalim të ri.',
  'If that address has an account, a link is on its way. It is good for one hour.':
    'Nëse kjo adresë ka një llogari, linku është në rrugë. Vlen një orë.',
  'Nothing in your inbox? Look in spam, or ask the studio — they can confirm you by hand.':
    'Nuk ka asgjë në inbox? Kontrollo te spam, ose pyet studion — mund të të konfirmojnë me dorë.',
  'Set a new password': 'Vendos fjalëkalim të ri',
  'New password': 'Fjalëkalimi i ri',
  'Repeat the password': 'Përsërit fjalëkalimin',
  'At least eight characters.': 'Të paktën tetë karaktere.',
  'Save the new password': 'Ruaj fjalëkalimin e ri',
  'The two passwords are not the same': 'Fjalëkalimet nuk përputhen',
  'Password changed. You are signed in.': 'Fjalëkalimi u ndryshua. Tani jeni brenda.',
  'Ask for a new link': 'Kërko një link të ri',
  'That link has expired or has already been used': 'Ky link ka skaduar ose është përdorur më parë',
  'Your email is not confirmed yet. Confirm it so we can send you a way back in if you forget your password.':
    'Email-i nuk është konfirmuar. Konfirmoje, që të kemi si të dërgojmë rrugën e kthimit nëse harron fjalëkalimin.',
  'Send the link again': 'Dërgoje linkun sërish',
  'Check your inbox for the link.': 'Shiko në inbox për linkun.',
  'Your email is confirmed. Thank you.': 'Email-i u konfirmua. Faleminderit.',
  'A link was sent a moment ago. Check your inbox, then try again in a few minutes.':
    'Një link u dërgua pak më parë. Shiko në inbox, pastaj provo sërish pas disa minutash.',
  'The letter could not be sent. Tell the studio and they will confirm you by hand.':
    'Letra nuk mund të dërgohej. Thuaji studios dhe do të konfirmojnë me dorë.',

  'The last letter could not be sent': 'Letra e fundit nuk mund të dërgohej',
  'Until this is fixed, nobody can get a password reset link. Reset at the desk in the meantime.':
    'Derisa kjo rregullohet, nuk mund të dërgohet link për fjalëkalim të ri. Ndërkohë rivendose fjalëkalimin te banaku.',
  'No reset links can be sent: the mail key is not set on the server. Clients who forget a password have to be reset at the desk.':
    'Nuk dërgohet asnjë link: çelësi i email-it nuk është vendosur në server. Klientet që harrojnë fjalëkalimin duhen rivendosur te banaku.',

  /* ---- what a package says on the website ---- */
  'How it reads on the website': 'Si duket në faqe',
  'Headline': 'Titulli i shkurtër',
  'Rhythm': 'Ritmi',
  'The short line under the name — "The sweet spot"': 'Rreshti i shkurtër nën emër — "Rutina ideale"',
  'How often it works out at — "Around 2x per week"': 'Sa shpesh del — "Afërsisht 2x në javë"',
  'The sentence at the foot of the card': 'Fjalia në fund të kartës',
  'In English (optional)': 'Në anglisht (opsionale)',
  'Left blank, the website shows the text above in both languages.':
    'Nëse e lë bosh, faqja tregon tekstin e mësipërm në të dyja gjuhët.',

  /* ---- days and months ---- */
  'Monday': 'E hënë', 'Tuesday': 'E martë', 'Wednesday': 'E mërkurë', 'Thursday': 'E enjte',
  'Friday': 'E premte', 'Saturday': 'E shtunë', 'Sunday': 'E diel',
  'January': 'Janar', 'February': 'Shkurt', 'March': 'Mars', 'April': 'Prill',
  'May': 'Maj', 'June': 'Qershor', 'July': 'Korrik', 'August': 'Gusht',
  'September': 'Shtator', 'October': 'Tetor', 'November': 'Nëntor', 'December': 'Dhjetor',
  'Jan': 'Jan', 'Feb': 'Shk', 'Mar': 'Mar', 'Apr': 'Pri', 'Jun': 'Qer', 'Jul': 'Kor',
  'Aug': 'Gus', 'Sep': 'Sht', 'Oct': 'Tet', 'Nov': 'Nën', 'Dec': 'Dhj',
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
  'Your membership': 'Abonimi yt',
  'Current plan': 'Paketa aktuale',
  'Most chosen': 'Më e zgjedhura',
  'Price coming soon': 'Çmimi së shpejti',
  'To be confirmed': 'Në pritje të konfirmimit',
  'Expired': 'Skaduar',
  'Active': 'Aktive',

  /* ---- the phone and tablet chrome ---- */
  'Account': 'Llogaria',
  'More': 'Më shumë',
  'More sections': 'Seksione të tjera',
  'Language': 'Gjuha',
  'Mark all as read': 'Shënoji si të lexuara',
  'Check your connection and try again. If it keeps happening, call or message the studio.':
    'Kontrollo lidhjen dhe provo sërish. Nëse vazhdon, telefono ose shkruaji studios.',
  'View': 'Pamja',
  'Saved': 'U ruajt',
  'Change': 'Ndrysho',
  'From': 'Nga',

  /* ---- the client's own screens ---- */
  'Book': 'Rezervo',
  'What you have, and what the studio offers': 'Çfarë ke, dhe çfarë ofron studioja',
  'Ask at the studio to start one': 'Pyet në studio për ta nisur',
  'Pay at the desk and we link it to your account. It shows here straight away and you can book.':
    'Paguaj te banaku dhe ne e lidhim me llogarinë tënde. Shfaqet këtu menjëherë dhe mund të rezervosh.',
  'See the packages': 'Shiko paketat',
  'Renew it at the studio and it is linked here again straight away.':
    'Rinovoje në studio dhe lidhet këtu sërish menjëherë.',
  'Still to come today': 'Ende sot',
  'Nothing else on today.': 'Asgjë tjetër sot.',
  'Leave': 'Dil',
  'You left the waitlist': 'Dole nga lista e pritjes',
  'Days': 'Ditët',
  'Nothing on the timetable for the coming days yet.': 'Ende asgjë në orar për ditët në vijim.',
  'Did not get a place': 'Nuk mori vend',
  'How to get one': 'Si ta marrësh',
  'Choose a package below and tell us at the studio. Pay at the desk and we link it to your account — it shows here straight away and you can start booking.':
    'Zgjidh një paketë më poshtë dhe na e thuaj në studio. Paguaj te banaku dhe ne e lidhim me llogarinë tënde — shfaqet këtu menjëherë dhe mund të nisësh rezervimet.',
  'Packages at DUA': 'Paketat në DUA',
  'The packages go up here soon.': 'Paketat ngjiten këtu së shpejti.',

  /* ---- employees ---- */
  'Employees': 'Punonjëset',
  'Employee': 'Punonjësja',
  'Role': 'Roli',
  'Takes': 'Merr',
  'Works': 'Punon',
  'Can take': 'Mund të marrë',
  'Body therapist / Physiotherapist': 'Terapiste trupi / Fizioterapiste',
  'Instructors and body therapists, and what each of them takes':
    'Instruktoret dhe terapistet, dhe çfarë merr secila',
  'Add employee': 'Shto punonjëse',
  'Add an employee': 'Shto një punonjëse',
  'Remove employee': 'Hiq punonjësen',
  'Employee added — they can sign in now': 'Punonjësja u shtua — mund të hyjë tani',
  'No employees yet. Add the first one and they can sign in straight away.':
    'Ende pa punonjëse. Shto të parën dhe mund të hyjë menjëherë.',
  'They lose access to the staff dashboard straight away.': 'E humbet aksesin te paneli menjëherë.',
  'Fill in the name, email and phone': 'Plotëso emrin, email-in dhe telefonin',
  'That email does not look right': 'Ky email nuk duket i saktë',
  'Pick at least one kind of class they can take': 'Zgjidh të paktën një lloj klase që mund të marrë',
  'At least eight characters. Give it to them in person; they can change it later.':
    'Të paktën tetë karaktere. Jepjani personalisht; mund ta ndryshojë më vonë.',
  'Pick what they do': 'Zgjidh çfarë bën',
  'No such employee': 'Nuk ka një punonjëse të tillë',
  'What I do': 'Çfarë bëj',
  'My hours': 'Orët e mia',
  'The studio only places you on these': 'Studioja të vendos vetëm në këto',
  'The studio only places you inside these hours': 'Studioja të vendos vetëm brenda këtyre orëve',
  'This week': 'Këtë javë',
  'I take': 'Marr',
  'Nothing assigned to you yet.': 'Ende asgjë e caktuar për ty.',
  'The studio places you once your hours are set. Check that they are right.':
    'Studioja të vendos sapo të jenë caktuar orët. Kontrollo që të jenë të sakta.',
  'Tick what you are happy to take on. The studio can only place you on these.':
    'Shëno çfarë je e gatshme të marrësh. Studioja mund të të vendosë vetëm në këto.',
  'Keep at least one': 'Mbaj të paktën një',
  'Not working': 'Nuk punon',
  'A class is only offered to you if it fits entirely inside your hours for that day.':
    'Një klasë të ofrohet vetëm nëse hyn e gjitha brenda orëve të tua për atë ditë.',

  /* ---- the schedule, as the desk sees it ---- */
  'Assign someone': 'Cakto punonjëse',
  'Who leads this class?': 'Kush e mban këtë klasë?',
  'Take them off this class': 'Hiqe nga kjo klasë',
  'Removed from the class': 'U hoq nga klasa',
  'Led by': 'E mban',
  'Places': 'Vende',
  'Fill in the date and both times': 'Plotëso datën dhe të dyja orët',
  'Capacity is at least one place': 'Kapaciteti është të paktën një vend',
  'Nobody is booked yet.': 'Askush nuk ka rezervuar ende.',
  'Nobody assigned': 'Pa punonjëse të caktuar',
  'Nothing to fix. Every class has someone qualified and free.':
    'Asgjë për të rregulluar. Çdo klasë ka dikë të kualifikuar dhe të lirë.',
  'clash': 'përplasje',
  'Removed': 'U hoq',
  'All in order': 'Gjithçka në rregull',

  /* ---- linking a membership ---- */
  'Link a membership': 'Lidh një abonim',
  'Link membership': 'Lidh abonimin',
  'Change membership': 'Ndrysho abonimin',
  'Linked here once a client has paid at the studio': 'Lidhen këtu pasi klientja paguan në studio',
  'Paid at the desk? Link it here.': 'Pagoi te banaku? Lidhe këtu.',
  'Pick the client and the package. It is active straight away and she can book from her phone. If she already has one, the new one replaces it.':
    'Zgjidh klienten dhe paketën. Bëhet aktive menjëherë dhe ajo mund të rezervojë nga telefoni. Nëse ka tashmë një, e reja e zëvendëson.',
  'Nobody has a membership yet. Link the first one once a client has paid.':
    'Askush nuk ka ende abonim. Lidh të parin sapo një kliente të paguajë.',
  'There are no packages yet. Add one under Packages first, then link it here.':
    'Ende nuk ka paketa. Shto një te Paketat fillimisht, pastaj lidhe këtu.',
  'Go to Packages': 'Shko te Paketat',
  'Used this period': 'Përdorur këtë periudhë',
  'Runs': 'Vlen',
  'Search by name, email or phone': 'Kërko me emër, email ose telefon',
  'Find a client': 'Gjej klienten',
  'Search clients': 'Kërko klientet',
  'No client matches that.': 'Asnjë kliente nuk përputhet.',
  'No clients have an account yet.': 'Asnjë kliente nuk ka ende llogari.',
  'No clients yet. They appear here as soon as they create an account in the app.':
    'Ende pa kliente. Shfaqen këtu sapo krijojnë një llogari në aplikacion.',
  'Pick a client first': 'Zgjidh fillimisht një kliente',
  'Pick a package': 'Zgjidh një paketë',
  'Pick a start and an end date': 'Zgjidh datën e fillimit dhe të mbarimit',
  'The membership has to end after it starts': 'Abonimi duhet të mbarojë pasi të fillojë',
  'That membership would already be over': 'Ky abonim do të kishte mbaruar tashmë',
  'A membership is active or cancelled': 'Një abonim është aktiv ose i anuluar',
  'No such client': 'Nuk ka një kliente të tillë',
  'Only link it once she has paid. It is active from the start date and she can book straight away.':
    'Lidhe vetëm pasi të ketë paguar. Është aktiv nga data e fillimit dhe ajo mund të rezervojë menjëherë.',
  'Extending the date or changing the package takes effect immediately, including for classes already booked.':
    'Zgjatja e datës ose ndryshimi i paketës hyn në fuqi menjëherë, edhe për klasat e rezervuara tashmë.',
  'A new password is made now, shown once, and never shown again. Read it out, and ask them to change it after signing in.':
    'Një fjalëkalim i ri krijohet tani, shfaqet një herë dhe nuk shfaqet më. Lexoje me zë dhe kërkoju ta ndryshojnë pasi të hyjnë.',
  'Give the package a name': 'Jepi paketës një emër',

  /* The notices the server writes, word for word. */
  'Your membership was updated by the studio.': 'Abonimi yt u përditësua nga studioja.',
  'Your password was reset at the studio. Ask for the new one at the desk.':
    'Fjalëkalimi yt u rivendos në studio. Kërko të riun te banaku.',

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
  'Create, move and staff the timetable': 'Krijo, zhvendos dhe cakto punonjëset në orar',
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
  'Unassigned': 'Pa punonjëse',
  'Recommended': 'E rekomanduar',
  'Nobody qualified is free at this time.': 'Asnjë e kualifikuar nuk është e lirë në këtë orë.',
  'Nobody yet.': 'Askush ende.',
  'Checked against qualifications, availability and clashes when you save.':
    'Kontrollohet kundrejt kualifikimeve, disponueshmërisë dhe përplasjeve kur ruan.',
  'Start must be before end': 'Fillimi duhet të jetë para mbarimit',
  'The class must end after it starts': 'Klasa duhet të mbarojë pasi të ketë filluar',
  'Things that were valid when they were set, and are not now':
    'Gjëra që ishin në rregull kur u caktuan, dhe nuk janë më',

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
  'Reset password': 'Rivendos fjalëkalimin',
  'Make a new password': 'Krijo fjalëkalim të ri',
  'Done': 'U krye',
  'Everywhere that account is signed in is signed out.':
    'Kudo ku ajo llogari është e kyçur, dilet.',
  'Write it down before you close this. It is not kept anywhere you can read it back.':
    'Shënoje para se ta mbyllësh. Nuk ruhet askund ku të lexohet përsëri.',
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
  'Edit %s': 'Ndrysho %s',
  'Adjust %s': 'Rregullo %s',
  'Retire %s': 'Tërhiq %s',
  'Remove %s': 'Hiq %s',
  'Added %s': '%s u shtua',
  'Removed %s': '%s u hoq',
  'Renews %s': 'Rinovohet më %s',
  'Reset the password for %s': 'Rivendos fjalëkalimin për %s',
  'Sending as %s. The provider answered: %s': 'Dërgohet si %s. Shërbimi u përgjigj: %s',
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
  'No one is on %s.': 'Askush nuk është me %s.',
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
  'Unlimited %s per %s': '%s pa limit në %s',
  '%s × %s per %s': '%s × %s në %s',
  '%s client is on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.':
    '%s kliente e ka %s tani. E mban derisa t\'i mbarojë — tërheqja vetëm ndalon blerje të reja.',
  '%s clients are on %s right now. They keep it until it runs out — retiring only stops anyone new from buying it.':
    '%s kliente e kanë %s tani. E mbajnë derisa t\'u mbarojë — tërheqja vetëm ndalon blerje të reja.',
  '%s retired': '%s u tërhoq',
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
  ' or ': ' ose ',
  'a package': 'një paketë',
  'membership': 'abonim',
  '⚠ unassigned': '⚠ pa caktuar',
  'Hello, %s': 'Përshëndetje, %s',
  'One left this %s': '1 e mbetur këtë %s',
  '%s of %s seats booked': '%s nga %s vende të rezervuara',
  '%s of %s booked': '%s nga %s të rezervuara',
  'No one is on %s. It stops being offered.': 'Askush nuk e ka %s. Nuk ofrohet më.',
  'Valid until %s': 'E vlefshme deri më %s',
  '%s place left': '%s vend i lirë',
  '%s places left': '%s vende të lira',
  'with %s': 'me %s',
  '%s day': '%s ditë',
  '%s days': '%s ditë',
  '%s / %s booked': '%s / %s të rezervuara',
  '%s – %s': '%s – %s',
  '%s client': '%s kliente',
  '%s clients': '%s kliente',
  '%s without a membership': '%s pa abonim',
  'until %s': 'deri më %s',
  'This replaces %s, which runs until %s.': 'Kjo zëvendëson %s, që vlen deri më %s.',
  '%s is now on %s': '%s tani ka %s',
  'Membership for %s': 'Abonim për %s',
  '%s clients are booked. They are told, and the class goes back on their balance.':
    '%s kliente kanë rezervuar. Njoftohen, dhe klasa u kthehet në bilanc.',
  '%s client is booked. She is told, and the class goes back on her balance.':
    '%s kliente ka rezervuar. Njoftohet, dhe klasa i kthehet në bilanc.',
  '%s upcoming classes will be left unassigned. Bookings are kept, and those clients are told someone new will lead it.':
    '%s klasa të ardhshme mbeten pa punonjëse. Rezervimet ruhen, dhe ato kliente njoftohen se do t\'i mbajë dikush tjetër.',
  '%s upcoming class will be left unassigned. Bookings are kept, and those clients are told someone new will lead it.':
    '%s klasë e ardhshme mbetet pa punonjëse. Rezervimet ruhen, dhe ato kliente njoftohen se do ta mbajë dikush tjetër.',
  'Removed — %s classes now need someone': 'U hoq — %s klasa tani kërkojnë punonjëse',
  'Removed — %s class now needs someone': 'U hoq — %s klasë tani kërkon punonjëse',
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
  [/^Not qualified for (.+)$/,                     (m) => 'E pakualifikuar për ' + m[1]],
  [/^Already on a class (.+)$/,                    (m) => 'Tashmë në një klasë ' + m[1]],
  [/^No (.+) classes left this (week|month)$/,     (m) => 'Nuk ka më klasa ' + m[1] + ' këtë ' + (m[2] === 'week' ? 'javë' : 'muaj')],
  [/^No classes left this (week|month)$/,          (m) => 'Nuk ka më klasa këtë ' + (m[1] === 'week' ? 'javë' : 'muaj')],
  [/^Missing (.+)$/,                               (m) => 'Mungon ' + m[1]],
  [/^No such class type: (.+)$/,                   (m) => 'Nuk ka lloj klase: ' + m[1]],
  [/^(\d+) spots? left$/,                          (m) => m[1] === '1' ? '1 vend i lirë' : m[1] + ' vende të lira'],

  /* The notices the server writes with a value inside them. Dates stay as
     2026-10-12 here; the screen that shows a notice turns them into words. */
  [/^Your membership (.+) is active until (\d{4}-\d{2}-\d{2})\.$/,
                                                   (m) => 'Abonimi yt ' + m[1] + ' është aktiv deri më ' + m[2] + '.'],
  [/^A place opened in the (\d\d:\d\d) class on (\d{4}-\d{2}-\d{2}) — you are in\.$/,
                                                   (m) => 'U lirua një vend në klasën e orës ' + m[1] + ', ' + m[2] + ' — je brenda.'],
  [/^Your class on (\d{4}-\d{2}-\d{2}) at (\d\d:\d\d) will be led by someone new\. Your place is safe\.$/,
                                                   (m) => 'Klasën tënde, ' + m[1] + ' në orën ' + m[2] + ', do ta mbajë dikush tjetër. Vendi yt është i sigurt.'],
  [/^Your class on (\d{4}-\d{2}-\d{2}) at (\d\d:\d\d) will now be led by (.+)\.$/,
                                                   (m) => 'Klasën tënde, ' + m[1] + ' në orën ' + m[2] + ', tani e mban ' + (m[3] === 'someone new' ? 'dikush tjetër' : m[3]) + '.'],
  [/^Your class moved to (\d{4}-\d{2}-\d{2}), (\d\d:\d\d)–(\d\d:\d\d)\.$/,
                                                   (m) => 'Klasa jote u zhvendos: ' + m[1] + ', ' + m[2] + '–' + m[3] + '.'],
  [/^The (\d\d:\d\d) class on (\d{4}-\d{2}-\d{2}) was cancelled\. Your session has been returned\.$/,
                                                   (m) => 'Klasa e orës ' + m[1] + ', ' + m[2] + ', u anulua. Seanca t\'u kthye.'],
  /* "Name — reason", as the server words a refusal about one person. */
  [/^(.+) — (.+)$/,                                (m) => m[1] + ' — ' + t(m[2])],
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
