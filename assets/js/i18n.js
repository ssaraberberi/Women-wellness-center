/* ============================================================
   DUA — English / Albanian
   ------------------------------------------------------------
   Translations are keyed by the English source string rather than by
   invented ids, so there are no keys to keep in sync and nothing silently
   falls back to a placeholder. A `data-sq` attribute on an element wins
   over the dictionary, for the few words that mean different things in
   different places.
   ============================================================ */
(function () {
  'use strict';

  var SQ = {
    /* ---- chrome ---- */
    'Skip to content': 'Kalo te përmbajtja',
    'Studio': 'Studio',
    'Massage': 'Masazh',
    'Schedule': 'Orari',
    'Memberships': 'Abonimet',
    'Community': 'Komuniteti',
    'Book now': 'Rezervo',
    'Book a class': 'Rezervo një klasë',
    'Inside the studio': 'Brenda studios',
    'Book a class': 'Rezervo një klasë',
    'Book DUA DUO': 'Rezervo DUA DUO',
    'Claim your spot': 'Merr vendin tënd',
    'Bring your bestie': 'Eja me bestie-n',
    'Scroll': 'Zbrit',
    'DUA, home': 'DUA, faqja kryesore',
    'Open menu': 'Hap menynë',
    'Close menu': 'Mbyll menynë',
    'Scroll to content': 'Zbrit te përmbajtja',
    'Choose a day': 'Zgjidh një ditë',
    'Reformer classes per month': 'Klasa reformeri në muaj',
    'Previous image': 'Fotoja e mëparshme',
    'Next image': 'Fotoja tjetër',
    'Close class details': 'Mbyll detajet e klasës',
    'Close booking': 'Mbyll rezervimin',
    'Albania': 'Shqipëri',
    'Hours': 'Orari',
    'Contact': 'Kontakt',
    'Back to top': 'Kthehu lart',
    'Privacy Policy': 'Politika e Privatësisë',
    'Delete account': 'Fshi llogarinë',
    'A ritual for yourself.': 'Një ritual për veten.',
    'Reformer · Mat Pilates · Barre · Yoga · Recovery': 'Reformer · Mat Pilates · Barre · Yoga · Rikuperim',
    'Coming soon': 'Së shpejti',

    /* ---- hero ---- */
    'Because': 'Sepse',
    'I want to.': 'dua.',
    'Because I want to': 'Sepse dua',
    'Tirana, Albania': 'Tiranë, Shqipëri',
    'Spa': 'Spa',
    'Reformer Pilates · Spa': 'Reformer Pilates · Spa',
    'Reformer Pilates & Spa': 'Reformer Pilates & Spa',

    /* ---- the idea ---- */
    'The idea': 'Ideja',
    'The hour': 'Ora',
    'you': 'që',
    'chose.': 'zgjodhe.',
    'The main floor, 17:40': 'Salla kryesore, 17:40',
    'DUA is small on purpose. One instructor who knows you, and a room where you never feel like just a number.':
      'DUA është e vogël me qëllim. Një instruktore që të njeh dhe një atmosferë ku nuk ndihesh sikur je thjesht një numër.',
    'Reformer Pilates and the spa, in one place. You can come straight from work, take your class and have a shower before you carry on with your day.':
      'Reformer Pilates dhe spa, në një vend. Mund të vish direkt nga puna, të bësh klasën tënde dhe të bësh një dush para se të vazhdosh ditën.',
    'And then there is the part outside the class: the bench by the window, a coffee afterwards and a little time to sit and talk. No rush.':
      'Dhe pastaj është ajo pjesa jashtë klasës: stoli pranë dritares, një kafe pas orës dhe pak kohë për të ndejtur e për të folur. Pa nxitim.',
    'See what a month looks like': 'Shih si duket një muaj',
    'Corrections, every class': 'Korrigjime, në çdo klasë',

    /* ---- four rituals ---- */
    'Two rituals': 'Dy ritualet',
    'Explore': 'Zbulo',
    'Strength you can feel in the way you stand.': 'Forcë që e ndien te mënyra si qëndron.',
    'Small moves. Serious shake.': 'Lëvizje të vogla. Dridhje serioze.',
    'The part of the day that belongs to you.': 'Pjesa e ditës që të takon ty.',
    'Rest is part of the practice.': 'Pushimi është pjesë e praktikës.',

    /* ---- reformer ---- */
    'The signature': 'Klasika jonë',
    'Strong, but in': 'E fortë, por në',
    'the right way.': 'mënyrën e duhur.',
    'Forty-five minutes that are only yours. Controlled movements, a calm tempo, and a class where the instructor has time to give you attention.':
      'Dyzet e pesë minuta vetëm për ty. Lëvizje të kontrolluara, një ritëm i qetë dhe një klasë ku instruktori ka kohë të të kushtojë vëmendje.',
    'It makes no difference whether you are starting now or have been doing reformer for a while. You come, you move, you breathe, and you leave feeling good — even if tomorrow you will remember the class. 🤍':
      'Nuk ka rëndësi nëse je duke filluar tani apo ke kohë që bën reformer. Vjen, lëviz, merr frymë dhe del duke u ndjerë mirë — edhe pse të nesërmen do ta kujtosh klasën. 🤍',
    'Strength, with control.': 'Forcë, por me kontroll.',
    'Spring resistance lets you build strength gradually, without loading your body with movements it does not need.':
      'Rezistenca me susta të lejon të ndërtosh forcë gradualisht, pa e ngarkuar trupin me lëvizje të panevojshme.',
    'With attention.': 'Me vëmendje.',
    'Every exercise is done calmly and with attention, so you genuinely feel the muscles that are working.':
      'Çdo ushtrim bëhet me qetësi dhe me vëmendje, që ta ndiesh vërtet muskujt që po punojnë.',
    'Posture.': 'Qëndrim.',
    'There is a lot of work for the trunk and the back too — especially if your day goes by in hours at a desk.':
      'Punohet shumë edhe me trungun dhe shpinën — sidomos nëse dita jote kalon me orë në tavolinë.',
    'First time?': 'Hera e parë?',
    'Before the class starts we show you how the reformer works and help you through every movement. After that you simply take your own pace.':
      'Para se të fillojë klasa, të tregojmë si funksionon reformeri dhe të ndihmojmë me çdo lëvizje. Pastaj thjesht merr ritmin tënd.',
    'In the end.': 'Në fund.',
    'What we are after is simple: that you feel stronger, more mobile and better in your own body.':
      'Ajo që kërkojmë është e thjeshtë: të ndihesh më e fortë, më e lëvizshme dhe më mirë në trupin tënd.',
    'Small groups': 'Grupe të vogla',
    'One instructor, and enough time in the room for every one of you.':
      'Një instruktore, dhe kohë e mjaftueshme në sallë për secilën prej jush.',
    'Hands-on': 'Korrigjime në vend',
    'Personal corrections in every single class.': 'Korrigjime personale në çdo klasë.',
    'Built for life': 'Për jetën e përditshme',
    'Posture, mobility, control and a back that stops complaining.':
      'Qëndrim, lëvizshmëri, kontroll dhe një shpinë që pushon së ankuari.',

    /* ---- recovery ---- */
    'Recovery': 'Rikuperimi',
    'Where the': 'Ku dita',
    'day stops.': 'ndalon.',
    'Two rooms at the back, kept deliberately dark and a little too warm — the part of the visit where the day finally lets go of you.':
      'Dy dhoma në fund, me qëllim të errëta dhe pak më të ngrohta se ç’duhet — pjesa e vizitës ku dita më në fund të lëshon.',
    'Deep tissue': 'Masazh i thellë',
    'Sports & post-training recovery': 'Sportiv & rikuperim pas stërvitjes',
    'Lymphatic drainage': 'Drenazh limfatik',
    'Aromatherapy & deep rest': 'Aromaterapi & pushim i thellë',
    'Explore treatments': 'Zbulo trajtimet',

    /* ---- coming soon ---- */
    'Timetable': 'Orari',
    'coming soon.': 'së shpejti.',
    'We are still putting the rooms together. Photographs as soon as it is ready.':
      'Ende po i rregullojmë dhomat. Fotot sapo të jetë gati.',
    'We are setting the first weeks of classes now. Message us and we will send you the times before they go up.':
      'Po caktojmë javët e para të klasave. Na shkruaj dhe të dërgojmë oraret para se të publikohen.',
    'Packages and prices are being finalised. Tell us what you are looking for and you will hear first.':
      'Paketat dhe çmimet po finalizohen. Na thuaj çfarë kërkon dhe do të jesh e para që merr vesh.',

    /* ---- schedule ---- */
    'The week': 'Java',
    'This week': 'Këtë javë',
    'at': 'te',
    'DUA.': 'DUA.',
    'Tap any class for the instructor, the level and what is left. Booking opens seven days ahead, and the 18:00 reformer always goes first.':
      'Prek një klasë për instruktoren, nivelin dhe vendet e lira. Rezervimet hapen shtatë ditë përpara, dhe reformeri i orës 18:00 mbaron gjithmonë i pari.',
    'Mon': 'Hën', 'Tue': 'Mar', 'Wed': 'Mër', 'Thu': 'Enj', 'Fri': 'Pre', 'Sat': 'Sht', 'Sun': 'Die',
    '14 Sep': '14 Sht', '15 Sep': '15 Sht', '16 Sep': '16 Sht', '17 Sep': '17 Sht',
    '18 Sep': '18 Sht', '19 Sep': '19 Sht', '20 Sep': '20 Sht',
    'Candlelit Restorative': 'Restorative me qirinj',
    'Beginners': 'Fillestare',
    'Intermediate': 'Mesatare',
    'Full — join the waitlist': 'Plot — hyr në listën e pritjes',
    'Instructor': 'Instruktorja',
    'Duration': 'Kohëzgjatja',
    'Level': 'Niveli',
    'Availability': 'Vendet',
    'Book this class': 'Rezervo këtë klasë',
    'Lead reformer instructor': 'Instruktore kryesore reformeri',
    'Reformer instructor': 'Instruktore reformeri',
    'Barre instructor': 'Instruktore barre',
    'Reformer & barre instructor': 'Instruktore reformeri & barre',
    'Yoga instructor': 'Instruktore yoga',
    'Yoga & recovery': 'Yoga & rikuperim',
    'Breath-led and unhurried, in the low morning light. Strong enough to wake you up properly, gentle enough to go to work after.':
      'E udhëhequr nga fryma dhe pa nxitim, në dritën e ulët të mëngjesit. Mjaft e fortë sa të të zgjojë si duhet, mjaft e butë sa të shkosh në punë pas saj.',
    'Spring-loaded, low impact, relentless. A full-body flow on the carriage with hands-on corrections from the front of the room.':
      'Me suste, me ndikim të ulët, e pandalshme. Një flow për tërë trupin mbi karrocë, me korrigjime në vend nga para sallës.',
    'Ballet-adjacent and genuinely evil. Movements about one centimetre wide. Your legs will shake, and so will everyone else’s.':
      'Afër baletit dhe vërtet e pamëshirshme. Lëvizje rreth një centimetër të gjera. Këmbët do të dridhen — dhe po ashtu edhe të të gjithave.',
    'Long holds, fewer shapes, more floor. The antidote to a day spent looking at screens.':
      'Mbajtje të gjata, më pak forma, më shumë dysheme. Kundërhelmi i një dite të kaluar para ekraneve.',
    'The one to start with. We walk you round the machine, explain what the springs actually do, and nobody expects you to know anything.':
      'Kjo është klasa për të filluar. Të shoqërojmë rreth makinerisë, të shpjegojmë ç’bëjnë vërtet sustat, dhe askush nuk pret që ti të dish gjë.',
    'Heavier springs, slower tempo, longer holds. You will feel this one in your hamstrings for two days.':
      'Suste më të rënda, ritëm më i ngadaltë, mbajtje më të gjata. Këtë do ta ndiesh te tendinat për dy ditë.',
    'Almost entirely on the floor, with bolsters and blankets. Bring socks. Nobody will make you chant.':
      'Pothuajse e tëra në dysheme, me jastëkë dhe batanije. Merr çorape. Askush nuk do të të vërë të këndosh mantra.',
    'Sunday evening, lights off, candles on. The quietest hour of the week, and the one that fills up first.':
      'Të dielën në mbrëmje, dritat fikur, qirinjtë ndezur. Ora më e qetë e javës — dhe e para që mbushet.',

    /* ---- memberships ---- */
    'Choose': 'Zgjidh',
    'yourself.': 'veten.',
    'No contracts, no joining fee.': 'Pa kontrata, pa tarifë anëtarësimi.',
    '8 classes / month': '8 klasa / muaj',
    '12 classes / month': '12 klasa / muaj',
    '16 classes / month': '16 klasa / muaj',
    'Small-group reformer, max 8': 'Reformer në grup të vogël, maks. 8',
    'Free foundations session': 'Seancë bazë falas',
    'Choose Reformer': 'Zgjidh Reformer',
    'Most loved': 'Më e dashura',
    'per month': 'në muaj',
    '12 reformer classes': '12 klasa reformeri',
    'Unlimited barre & yoga': 'Barre & yoga pa limit',
    'One 50-min massage a month': 'Një masazh 50-minutësh në muaj',
    'Choose Wellness': 'Zgjidh Wellness',
    'unlimited / month': 'pa limit / muaj',
    'Mat, towel & grip socks': 'Dyshek, peshqir & çorape me kapje',
    'Sunday candlelit flow': 'Flow me qirinj të dielave',
    'Choose Movement': 'Zgjidh Movement',
    'First class 990 ALL': 'Klasa e parë 990 ALL',
    '· Drop-in 1,800 ALL · Student rates available': '· Një klasë 1,800 ALL · Çmime për studentet',

    /* ---- opening soon ---- */
    'Opening': 'Hapemi',
    'soon.': 'së shpejti.',
    'Reformer Pilates and the spa, in Tirana. Message us and you will be the first to know when we open.':
      'Reformer Pilates dhe spa, në Tiranë. Na shkruaj dhe do të jesh e para që merr vesh kur të hapim.',

    /* ---- the space ---- */
    'The space': 'Hapësira',
    'The studio': 'Studioja',
    'The reformer room': 'Salla e reformerëve',
    'Changing rooms': 'Dhomat e zhveshjes',
    'The mat studio': 'Salla e ushtrimeve të tokës',
    'Your locker': 'Dollapi yt',
    'The washroom': 'Lavamanët',

    /* ---- community + final ---- */
    'Follow along': 'Na ndiq',
    'Thursday, 19:00': 'E enjte, 19:00',
    'Coffee, downstairs': 'Kafe, poshtë',
    'New socks, new set': 'Çorape të reja, set i ri',
    'Sunday, slow': 'E diel, ngadalë',
    'Candlelit flow': 'Flow me qirinj',
    'Recovery day': 'Ditë rikuperimi',
    'When you': 'Kur',
    'want to.': 'të duash.',
    'Book your first class': 'Rezervo klasën tënde të parë',

    /* ---- whatsapp ---- */
    'Usually replies within the hour': 'Zakonisht përgjigjemi brenda një ore',
    'Questions about memberships, the timetable or your first class? Message us and we will get back to you.':
      'Pyetje për abonimet, oraret apo klasën e parë? Na shkruani dhe ju kthejmë përgjigje.',
    'Message on WhatsApp': 'Shkruaj në WhatsApp',
    'Message us on WhatsApp': 'Na shkruani në WhatsApp',

    /* ---- booking ---- */
    'Your first class is 990 ALL.': 'Klasa jote e parë është 990 ALL.',
    'Make space for yourself.': 'Bëj vend për veten.',
    'Full name': 'Emri i plotë',
    'Phone': 'Telefon',
    'What would you like to book?': 'Çfarë dëshiron të rezervosh?',
    'Wellness membership': 'Abonim Wellness',
    'Choose a time': 'Zgjidh një orar',
    'Tue 15': 'Mar 15', 'Wed 16': 'Mër 16', 'Thu 17': 'Enj 17',
    'Confirm booking': 'Konfirmo rezervimin',
    'This is a design mockup — no booking is actually made.':
      'Ky është një model dizajni — nuk kryhet asnjë rezervim i vërtetë.',
    'Confirmed': 'Konfirmuar',
    'See you soon.': 'Shihemi së shpejti.',
    "We've held your place. Arrive ten minutes early for your first class — grip socks are on us.":
      'Vendi yt është ruajtur. Eja dhjetë minuta më herët për klasën e parë — çorapet me kapje i kemi ne.',
    'Close': 'Mbyll',

    /* ---- packages ---- */
    'Price coming soon': 'Çmimi së shpejti',
    'Two friends join the same package together for the first time, and both pay less.':
      'Dy shoqe marrin të njëjtën paketë bashkë për herë të parë, dhe të dyja paguajnë më pak.',
    'Packages are coming soon. Message us and we will tell you first.':
      'Paketat vijnë së shpejti. Na shkruaj dhe do të jesh e para që e di.',
    'The closest thing to what you described.': 'Më e afërta me atë që përshkrove.',
    'Ask us at the studio and we will put the right one together for you.':
      'Na pyet në studio dhe do ta bëjmë paketën e duhur për ty.',
    'Two friends join DUA ROUTINE together for the first time, and both pay less.':
      'Dy shoqe blejnë DUA ROUTINE së bashku për herë të parë, dhe të dyja paguajnë më pak.',

    'Packages': 'Paketat',
    'Find your': 'Gjej rutinën',
    'DUA routine.': 'tënde DUA.',
    'The more you move, the more you save.': 'Sa më shumë lëviz, aq më shumë kursen.',
    'Most popular': 'Më e përzgjedhura',
    'classes': 'klasa',
    'class': 'klasë',
    'Or just one class': 'Ose vetëm një klasë',
    'One to one': 'Një me një',
    'Not sure?': 'Nuk je e sigurt?',
    'Which one': 'Cila është',
    'is yours?': 'e jotja?',
    'Three or four questions. Nothing is saved and nothing is sent — the answer is one of the packages below.':
      'Tri ose katër pyetje. Nuk ruhet asgjë dhe nuk dërgohet asgjë — përgjigjja është një nga paketat më poshtë.',
    'Yours': 'Për ty',
    'Show me': 'Ma trego',
    'Start again': 'Nise nga fillimi',
    'Back': 'Kthehu',
    'What are you here for?': 'Për çfarë je këtu?',
    'Massage and spa': 'Masazh dhe spa',
    'Both': 'Të dyja',
    'Have you been on a reformer before?': 'A ke qenë më parë mbi reformer?',
    'Never': 'Kurrë',
    'A few times': 'Ca herë',
    'Yes, regularly': 'Po, rregullisht',
    'How often would you like to come?': 'Sa shpesh do të doje të vije?',
    'Just once, to see': 'Vetëm një herë, për ta parë',
    'About once a week': 'Rreth një herë në javë',
    'Twice a week': 'Dy herë në javë',
    'Three or four times a week': 'Tri ose katër herë në javë',
    'In a small group, or one to one?': 'Në grup të vogël, apo një me një?',
    'A small group': 'Në grup të vogël',
    'Either is fine': 'Të dyja më rrinë mirë',
    'What would you like it to do?': 'Çfarë do të doje që të bëjë?',
    'Switch everything off': 'Të fikë gjithçka',
    'Make me feel lighter': 'Të më bëjë të ndihem më e lehtë',
    'Work on firming': 'Të punojë mbi fortësimin',
    'Ease aching muscles': 'Të lehtësojë muskujt e lodhur',
    'One treatment, or a few?': 'Një trajtim, apo disa?',
    'Just one': 'Vetëm një',
    'A few, over time': 'Disa, me kohë',
    'How long?': 'Sa gjatë?',
    'An hour': 'Një orë',
    'The full ninety minutes': 'Nëntëdhjetë minutat e plota',
    'How often on the reformer?': 'Sa shpesh mbi reformer?',
    'Once a week': 'Një herë në javë',
    'Three times a week': 'Tri herë në javë',
    'Just once — a treat': 'Vetëm një herë — një shije',
    'And what should the massage do?': 'Dhe çfarë duhet të bëjë masazhi?',
    'Relax me': 'Të më relaksojë',
    'Leave me lighter': 'Të më lërë më të lehtë',
    'Just you, or two of you?': 'Vetëm ti, apo të dyja?',
    'Just me': 'Vetëm unë',
    'Two of us': 'Të dyja',
    'One to one, so the whole class is built around you.':
      'Një me një, që e gjithë klasa të ndërtohet rreth teje.',
    'A first class, at the price we keep for a first class.':
      'Klasa e parë, me çmimin që mbajmë për klasën e parë.',
    'One class, no package, whenever it suits you.': 'Një klasë, pa paketë, kurdo që të vjen mirë.',
    'Four classes a month is about once a week.':
      'Katër klasa në muaj janë rreth një herë në javë.',
    'Eight classes a month is about twice a week — and the best price per class for that rhythm.':
      'Tetë klasa në muaj janë rreth dy herë në javë — dhe çmimi më i mirë për klasë në atë ritëm.',
    'Sixteen classes a month, and the lowest price per class we have.':
      'Gjashtëmbëdhjetë klasa në muaj, dhe çmimi më i ulët për klasë që kemi.',
    'Twelve classes a month is about three times a week — room to build without overcommitting.':
      'Dymbëdhjetë klasa në muaj janë rreth tri herë në javë — hapësirë për të ndërtuar pa u mbingarkuar.',
    'Five lymphatic treatments, which is where this one works best.':
      'Pesë trajtime limfatike, sepse aty punon më mirë ky.',
    'Five sculpt treatments — body care asks for repetition.':
      'Pesë trajtime sculpt — body-care kërkon përsëritje.',
    'Deep recovery is not sold as a pack yet, so this is the treatment on its own.':
      'Deep recovery nuk shitet ende si paketë, ndaj ky është trajtimi më vete.',
    'Three relax treatments, at less than three separate ones.':
      'Tri trajtime relaks, më lirë se tri veç e veç.',
    'Ninety minutes, and the one we built to be the whole experience.':
      'Nëntëdhjetë minuta, dhe ai që e ndërtuam si eksperiencën e plotë.',
    'Lymphatic massage, for lightness and recovery.': 'Masazh limfatik, për lehtësi dhe rikuperim.',
    'Sculpt, for firming and body care.': 'Sculpt, për fortësim dhe body-care.',
    'A deeper massage, for muscular tension.': 'Masazh më i thellë, për tension muskulor.',
    'An hour that asks nothing of you.': 'Një orë që nuk të kërkon asgjë.',
    'Two of you, one price — a class and a massage each.':
      'Të dyja, një çmim — nga një klasë dhe një masazh secila.',
    'One class and one massage. A weekend, or a gift.':
      'Një klasë dhe një masazh. Një fundjavë, ose një dhuratë.',
    'Four classes and a massage — enough to start both at once.':
      'Katër klasa dhe një masazh — sa duhet për t\'i nisur të dyja njëherësh.',
    'Twelve classes and four lymphatic treatments, which is the most movement with recovery behind it.':
      'Dymbëdhjetë klasa dhe katër trajtime limfatike — lëvizja më e madhe, me rikuperimin pas saj.',
    'Eight classes and four sculpt treatments, for body care alongside the work.':
      'Tetë klasa dhe katër trajtime sculpt, për body-care krah punës.',
    'Eight classes and two lymphatic treatments — movement and recovery in step.':
      'Tetë klasa dhe dy trajtime limfatike — lëvizja dhe rikuperimi në hap.',
    'Eight classes and two massages — the one most people settle on.':
      'Tetë klasa dhe dy masazhe — ajo ku ndalen shumica.',
    'Kinds of package': 'Llojet e paketave',
    'Pilates': 'Pilates',
    'Massages': 'Masazhet',
    'Combinations': 'Kombinimet',
    'A short, premium menu: relaxation, recovery and body care.':
      'Një meny e shkurtër dhe premium: relaks, recovery dhe body-care.',
    'Where movement meets recovery — and every visit is worth more.':
      'Këtu bashkohet movement me recovery — dhe rritet vlera e çdo vizite.',
    'Total relaxation': 'Relaks total',
    'Lightness and recovery': 'Lehtësi dhe rikuperim',
    'Firming and body care': 'Fortësim dhe kujdes trupor',
    'Release and restore': 'Lirim dhe rikthim',
    'The full DUA experience': 'Eksperienca e plotë DUA',
    '30 minutes · 2,000 L': '30 minuta · 2,000 L',
    'For unwinding and wellbeing': 'Për çlodhje dhe mirëqenie',
    'Lymphatic massage': 'Masazh limfatik',
    'Wellness focus': 'Fokus wellness',
    'For a regular routine': 'Për rutinë të rregullt',
    'Sculpt and anti-cellulite': 'Sculpt dhe anticelulit',
    'Body care': 'Body-care',
    'For specific areas': 'Për zonat trupore',
    'A deeper massage': 'Masazh më i thellë',
    'For muscular tension': 'Për tension muskulor',
    'Ideal after activity': 'Ideal pas aktivitetit',
    '90 minutes': '90 minuta',
    'A personalised experience': 'Eksperiencë e personalizuar',
    'Relaxation and recovery': 'Relaks dhe recovery',
    'Massage packages': 'Paketat e masazheve',
    '3 × Relax 60′': '3 × Relax 60′',
    '5 × Lymph 60′': '5 × Lymph 60′',
    '5 × Sculpt 60′': '5 × Sculpt 60′',
    'Lymphatic and anti-cellulite treatments are wellness and aesthetic care. They do not replace medical advice.':
      'Shërbimet limfatike dhe anticelulit janë wellness/estetikë dhe nuk zëvendësojnë këshillën mjekësore.',
    'Our main package': 'Paketa kryesore',
    'Eight classes and two massages, every month.': 'Tetë klasa dhe dy masazhe, çdo muaj.',
    '4 Pilates + 1 Relax 60′': '4 Pilates + 1 Relax 60′',
    '8 Pilates + 2 Relax 60′': '8 Pilates + 2 Relax 60′',
    '8 Pilates + 4 Sculpt': '8 Pilates + 4 Sculpt',
    '12 Pilates + 4 Lymph': '12 Pilates + 4 Lymph',
    '8 Pilates + 2 Lymph': '8 Pilates + 2 Lymph',
    '1 Pilates + 1 Relax 60′': '1 Pilates + 1 Relax 60′',
    '2 people · 1 Pilates + 1 Relax each': '2 persona · 1 Pilates + 1 Relax secili',
    '10,900 L for both': '10,900 L për të dyja',
    'Perfect to begin with': 'Perfekte për fillim',
    'For body care': 'Për body-care',
    'The premium package': 'Paketë premium',
    'Movement and recovery': 'Movement dhe recovery',
    'A gift, or a weekend': 'Dhuratë, ose fundjavë',
    'The bestie experience': 'Bestie experience',
    'Our signature formula': 'Formula jonë',
    'builds.': 'ndërton.',
    'recovers.': 'rikuperon.',
    'they change things.': 'ndryshojnë gjithçka.',
    'Massage': 'Masazhi',
    'Together': 'Bashkë',
    'Personal': 'Personal',
    'training.': 'training.',
    'Packages with personal training, too — one to one with your instructor, and a class built entirely around you.':
      'Edhe paketa me personal training — një me një me instruktoren tënde, dhe një klasë e ndërtuar tërësisht rreth teje.',
    'For a first time on the reformer, for working on something specific, or simply for the full attention.':
      'Për herën e parë mbi reformer, për të punuar mbi diçka të caktuar, ose thjesht për vëmendjen e plotë.',
    'Meet DUA': 'Provo DUA',
    'Your class, your time': 'Një klasë, kur të duash',
    'Build the habit': 'Fillo rutinën',
    'The sweet spot': 'Rutina ideale',
    'Take it further': 'Bëje pjesë të rutinës tënde',
    'For the Pilates girls': 'Për Pilates girls',
    '1 Reformer class': '1 klasë Reformer',
    'New clients only': 'Vetëm për klientet e reja',
    'Can only be purchased once': 'Mund të blihet vetëm një herë',
    'Perfect for experiencing DUA before choosing a package':
      'Për të provuar eksperiencën DUA para se të zgjedhësh një paketë',
    'No package required': 'Nuk kërkon paketë',
    'Perfect for occasional visits': 'Ideale për vizita individuale',
    '4 classes': '4 klasa',
    'Around 1x per week': 'Afërsisht 1x në javë',
    '1,800 L / class': '1,800 L / klasë',
    'Perfect for getting started': 'E përshtatshme për dikë që sapo po fillon',
    '8 classes': '8 klasa',
    'Around 2x per week': 'Afërsisht 2x në javë',
    '1,650 L / class': '1,650 L / klasë',
    'The ideal balance between consistency, results and value':
      'Balanca ideale mes rutinës, rezultateve dhe çmimit',
    '12 classes': '12 klasa',
    'Around 3x per week': 'Afërsisht 3x në javë',
    '1,500 L / class': '1,500 L / klasë',
    'Designed for greater consistency in your Pilates routine':
      'Për më shumë vazhdimësi në Pilates',
    '16 classes': '16 klasa',
    'Around 4x per week': 'Afërsisht 4x në javë',
    '1,400 L / class': '1,400 L / klasë',
    'Our largest package for our most active clients':
      'Paketa jonë më e madhe për klientet më aktive',
    'Special offers': 'Oferta speciale',
    'Two friends join DUA ROUTINE together for the first time and pay 12,500 L each instead of 13,200 L.':
      'Dy shoqe blejnë DUA ROUTINE së bashku për herë të parë dhe paguajnë 12,500 L secila në vend të 13,200 L.',
    'Bring your Pilates bestie': 'Eja me bestie-n tënde',
    'Exclusive launch offer for the first 20–30 DUA clients. Receive 10–15% off your first package + exclusive launch benefits.':
      'Ofertë launch-i për 20–30 klientet e para të DUA. Përfitojnë 10–15% ulje në paketën e parë + benefite ekskluzive launch-i.',
    'Limited spots available.': 'Vende të limituara.',
    'Refer a friend. When she purchases a DUA package, you both receive 1 bonus class.':
      'Refero një shoqe. Nëse ajo blen një paketë DUA, të dyja përfitoni nga 1 klasë bonus.',

    /* ---- questions ---- */
    'Questions': 'Pyetje',
    'Before your': 'Para klasës',
    'first class.': 'sate të parë.',
    'What is reformer Pilates?': 'Çfarë është reformer Pilates?',
    'A Pilates class on a sprung carriage. The springs carry part of your weight and give you something to work against, so the movement stays controlled and your joints are not taking the load. It is low impact, and it builds strength you can feel.':
      'Një klasë Pilates mbi një karrocë me susta. Sustat mbajnë një pjesë të peshës sate dhe të japin diçka kundër së cilës të punosh, kështu që lëvizja mbetet e kontrolluar dhe nyjet nuk e marrin ngarkesën. Është me ndikim të ulët, dhe ndërton forcë që e ndien.',
    'Do I need experience?': 'A më duhet përvojë?',
    'No. Plenty of people come to a first class having never been on a reformer, and the class is built for exactly that. The groups are small enough that the instructor sets your springs, corrects your position and keeps an eye on you the whole time.':
      'Jo. Shumë vajza vijnë në klasën e parë pa qenë kurrë mbi një reformer, dhe klasa është ndërtuar pikërisht për këtë. Grupet janë aq të vogla sa instruktorja t\'i vendos sustat, të korrigjon qëndrimin dhe të ka sytë mbi ty gjithë kohës.',
    'How long is a class?': 'Sa zgjat një klasë?',
    'Fifty minutes.': 'Pesëdhjetë minuta.',
    'Where in Tirana are you?': 'Ku ndodheni në Tiranë?',
    'The map is just below — tap it and Google Maps takes you to the door. We are open Monday to Saturday, 07:00 to 21:00.':
      'Harta është pak më poshtë — prek atë dhe Google Maps të çon deri te dera. Jemi hapur nga e hëna në të shtunë, 07:00 deri 21:00.',

    /* ---- timetable ---- */
    'Timetable,': 'Orari,',
    'Monday to Saturday.': 'nga e hëna në të shtunë.',
    'Every class is fifty minutes and starts on the hour, so it is easy to fit into your day.':
      'Çdo klasë zgjat pesëdhjetë minuta dhe fillon në orë të plotë, që ta futësh lehtë në ditën tënde.',
    'Opening hours': 'Orari i hapjes',
    'Monday – Saturday': 'E hënë – e shtunë',
    'Monday – Saturday, 07:00 – 21:00': 'E hënë – e shtunë, 07:00 – 21:00',
    'Closed on Sunday': 'Të dielën mbyllur',
    'Closed': 'Mbyllur',
    'Monday': 'E hënë', 'Tuesday': 'E martë', 'Wednesday': 'E mërkurë', 'Thursday': 'E enjte',
    'Friday': 'E premte', 'Saturday': 'E shtunë', 'Sunday': 'E diel',
    'Reformer': 'Reformer',
    'one person at a time': 'një person në një kohë',
    'small group on the reformer': 'grup i vogël në reformer',

    /* ---- find us ---- */
    'Find us': 'Na gjej',
    'Come by': 'Eja në',
    'the studio.': 'studio.',
    'Where': 'Ku',
    'Open': 'Hapur',
    'Call or write': 'Telefono ose shkruaj',
    'Get directions': 'Merr udhëzimet',
    'Open in Google Maps': 'Hape në Google Maps',
    'Map: DUA Pilates & SPA, Tirana': 'Harta: DUA Pilates & SPA, Tiranë',
    'What does the spa offer?': 'Çfarë ofron spa-ja?',
    'Treatments in the same place as the studio, so recovery sits inside your week instead of beside it.':
      'Trajtime në të njëjtin vend me studion, që rikuperimi të rrijë brenda javës sate dhe jo anash saj.',

    /* ---- alt text ---- */
    'The reformer room in afternoon light, the DUA wall above a long bed of cacti':
      'Salla e reformerëve në dritën e pasdites, muri DUA mbi një shtrat të gjatë kaktusësh',
    'Three reformers facing the arched mirrors, morning light across the floor':
      'Tre reformerë përballë pasqyrave me hark, drita e mëngjesit mbi dysheme',
    'An instructor correcting two clients on the reformers, the room lit low':
      'Një instruktore duke korrigjuar dy kliente mbi reformerë, salla me dritë të ulët',
    'Reformers and arched mirrors in the evening, lit by a single lamp':
      'Reformerë dhe pasqyra me hark në mbrëmje, ndriçuar nga një llambë e vetme',
    'A woman crossing the studio beneath the DUA wall, reformers waiting below':
      'Një grua duke kaluar nëpër studio nën murin DUA, reformerët duke pritur poshtë',
    'Hands working across a back during a deep tissue massage': 'Duar që punojnë mbi shpinë gjatë një masazhi të thellë',
    'Hands working slowly across a back during a treatment': 'Duar që punojnë ngadalë mbi shpinë gjatë një trajtimi',
    'A quiet, warm treatment corridor': 'Një korridor i qetë dhe i ngrohtë trajtimesh',
    'The reformer room, with pink carriages along the arched windows':
      'Salla e reformerëve, me karroca rozë përgjatë dritareve me harqe',
    'The changing room in pink tile, with a backlit oval mirror':
      'Dhoma e zhveshjes me pllaka rozë dhe një pasqyrë ovale e ndriçuar',
    'The mat studio, arches and mirrors lit in pink, mats laid out with rings and balls':
      'Salla e ushtrimeve të tokës, harqe dhe pasqyra të ndriçuara rozë, dyshekë të shtruar me unaza dhe topa',
    'An open locker with a water bottle, wash bag and trainers':
      'Një dollap i hapur me shishe uji, çantë higjienike dhe atlete',
    'The washroom, plaster walls with stone basins and oval mirrors':
      'Lavamanët, mure me suva, lavamanë guri dhe pasqyra ovale',
    'Side plank on the reformer': 'Plank anësor mbi reformer',
    'A cup of coffee resting in soft cream linen': 'Një filxhan kafe mbi liri të butë ngjyrë kremi',
    'Grip socks braced against the reformer footbar': 'Çorape me kapje të mbështetura te shufra e reformerit',
    'Legs along the barre in Sunday class': 'Këmbë përgjatë barres në klasën e së dielës',
    'Candle and ceramic cup in the studio lounge': 'Qiri dhe filxhan qeramike në sallonin e studios',
    'Hands and white linen in the treatment room': 'Duar dhe liri e bardhë në dhomën e trajtimit',

    /* ---- the November 2026 redesign: homepage ---- */
    'Reformer': 'Reformer',
    'Private': 'Private',
    'Visit': 'Na vizito',
    'Book your class': 'Rezervo klasën',
    'Language': 'Gjuha',
    'Private sessions': 'Seanca private',
    'Reformer Pilates & Spa · Tirana': 'Reformer Pilates & Spa · Tiranë',
    'Movement, recovery and a little time just for you.': 'Lëvizje, rikuperim dhe pak kohë vetëm për ty.',
    'Explore the studio': 'Zbulo studion',
    'The reformer studio in daylight: oak reformers, a lit shelf and the DUA wall':
      'Studio e reformerit në dritë dite: reformerë lisi, një raft i ndriçuar dhe muri DUA',
    'The studio': 'Studio',
    'A space to move.': 'Një hapësirë për të lëvizur.',
    'A moment to pause.': 'Një çast për të ndalur.',
    'DUA brings together mindful movement and considered recovery in a space designed around you.':
      'DUA bashkon lëvizjen e vetëdijshme dhe rikuperimin e kujdesshëm, në një hapësirë të menduar për ty.',
    'An oak shelf lit from within, holding balls, rings and blocks, beside the DUA wall':
      'Një raft lisi i ndriçuar nga brenda, me topa, unaza dhe blloqe, pranë murit DUA',
    'A reformer under the DUA wall, cacti and lavender along the window':
      'Një reformer nën murin DUA, kaktuse dhe livando përgjatë dritares',
    'Strength in': 'Forcë në',
    'every movement.': 'çdo lëvizje.',
    'Fifty minutes on the reformer in a small group. Your instructor sets your springs, corrects your form and keeps the pace calm, whether it is your first class or your hundredth.':
      'Pesëdhjetë minuta në reformer, në një grup të vogël. Instruktorja të rregullon sustat, të korrigjon formën dhe e mban ritmin të qetë, qoftë klasa jote e parë apo e qindta.',
    'Small groups': 'Grupe të vogla',
    'Time for every one of you.': 'Kohë për secilën prej jush.',
    'Hands-on': 'Kujdes personal',
    'Corrections in every class.': 'Korrigjime në çdo klasë.',
    'First time': 'Herën e parë',
    'We show you the reformer before you start.': 'Të tregojmë reformerin para se të fillosh.',
    'Explore Pilates': 'Zbulo Pilates',
    'A treatment room by candlelight, a therapist at work beneath a woven fan':
      'Një dhomë trajtimi në dritë qiriu, një terapiste në punë nën një freskore të thurur',
    'Your moment': 'Momenti yt',
    'to reset.': 'për t’u çlodhur.',
    'Relaxing and deep-tissue massage, lymphatic drainage and body sculpting, in rooms kept warm, dim and quiet.':
      'Masazh relaksues dhe i thellë, drenazh limfatik dhe sculpt trupi, në dhoma të ngrohta, me dritë të butë dhe të qeta.',
    'Explore Spa': 'Zbulo Spa',
    'The DUA experience': 'Përvoja DUA',
    'Small on purpose.': 'E vogël me qëllim.',
    'Personal by design.': 'Personale që në krijim.',
    'Small group classes': 'Klasa në grupe të vogla',
    'A few reformers in the room, so nobody is just a number.': 'Pak reformerë në sallë, që askush të mos jetë thjesht një numër.',
    'Personal guidance': 'Udhëzim personal',
    'Springs set, form corrected, every class.': 'Sustat të rregulluara, forma e korrigjuar, në çdo klasë.',
    'Private and semi-private': 'Private dhe gjysmë-private',
    'One to one, or with one or two people you choose.': 'Një me një, ose me një a dy persona që zgjedh ti.',
    'A considered space': 'Një hapësirë e menduar',
    'Daylight, warm oak and quiet rooms.': 'Dritë dite, dru lisi i ngrohtë dhe dhoma të qeta.',
    'Pilates and spa together': 'Pilates dhe spa bashkë',
    'Move, then recover, in the same place.': 'Lëviz, pastaj rikuperohu, në të njëjtin vend.',
    'The whole hour,': 'E gjithë ora,',
    'shaped around you.': 'e ndërtuar rreth teje.',
    'A session built for your body and your goals, at a time agreed with your instructor.':
      'Një seancë e ndërtuar për trupin dhe qëllimet e tua, në një orar të rënë dakord me instruktoren.',
    'You and your instructor, with every minute given to you.': 'Ti dhe instruktorja, çdo minutë vetëm për ty.',
    'Semi-private': 'Gjysmë-private',
    'Train alongside a friend or partner, at your shared pace.': 'Stërvitu krah një shoqeje ose partneri, me ritmin tuaj të përbashkët.',
    'Small private group': 'Grup i vogël privat',
    'Three of you, one instructor, a class of your own.': 'Tre veta, një instruktore, një klasë vetëm e juaja.',
    'Ask about private sessions': 'Pyet për seancat private',
    'By arrangement. Message us for times and prices.': 'Me marrëveshje. Na shkruaj për oraret dhe çmimet.',
    'Monthly packages on the reformer, spa treatments, and the two together.':
      'Paketa mujore në reformer, trajtime spa, dhe të dyja bashkë.',
    'Kinds of package': 'Llojet e paketave',
    'Pilates + Spa': 'Pilates + Spa',
    'Single treatments and series. Descriptions and the full menu are on the':
      'Trajtime të vetme dhe seri. Përshkrimet dhe menuja e plotë janë te',
    'spa page': 'faqja e spa-s',
    'Reformer classes and spa treatments in one package.': 'Klasa reformeri dhe trajtime spa në një paketë.',
    'Packages are loading. If they do not appear, message us and we will send them to you.':
      'Paketat po ngarkohen. Nëse nuk shfaqen, na shkruaj dhe t’i dërgojmë.',
    'Packages will be here shortly. Message us and we will send them to you.':
      'Paketat do të jenë këtu së shpejti. Na shkruaj dhe t’i dërgojmë.',
    'Current offers': 'Ofertat aktuale',
    'For a limited time, on top of the packages above.': 'Për një kohë të kufizuar, përveç paketave më sipër.',
    'Choose': 'Zgjidh',
    'Single classes': 'Klasa të vetme',
    'Book this offer': 'Rezervo ofertën',
    'Not sure?': 'Nuk je e sigurt?',
    'Which one': 'Cila',
    'is yours?': 'është e jotja?',
    'Three or four questions. Nothing is saved and nothing is sent — the answer is one of the packages above.':
      'Tre ose katër pyetje. Asgjë nuk ruhet dhe asgjë nuk dërgohet — përgjigjja është një nga paketat më sipër.',
    'Reformers in a row in the evening, a warm light along the curtains':
      'Reformerë në rresht në mbrëmje, një dritë e ngrohtë përgjatë perdeve',
    'The DUA ritual': 'Rituali DUA',
    'Move. Restore.': 'Lëviz. Rikuperohu.',
    'Repeat.': 'Përsërit.',
    'A class on the reformer, then a treatment down the hall. Strength and recovery in one visit, without crossing the city in between.':
      'Një klasë në reformer, pastaj një trajtim pak hapa më tej. Forcë dhe rikuperim në një vizitë, pa e kapërcyer qytetin mes tyre.',
    'Move': 'Lëviz',
    'Fifty minutes on the reformer.': 'Pesëdhjetë minuta në reformer.',
    'Restore': 'Rikuperohu',
    'A massage while the work settles.': 'Një masazh, ndërsa trupi qetësohet pas punës.',
    'Repeat': 'Përsërit',
    'A week with room for both.': 'Një javë me vend për të dyja.',
    'See Pilates + Spa packages': 'Shiko paketat Pilates + Spa',
    'The spa menu': 'Menuja e spa-s',
    'to Saturday.': 'deri të shtunën.',
    'Every class is fifty minutes and starts on the hour.': 'Çdo klasë zgjat pesëdhjetë minuta dhe fillon në orë të plotë.',
    'A Pilates class on a sprung carriage. The springs carry part of your weight and give you something to work against, so the movement stays controlled and low impact.':
      'Një klasë Pilates mbi një karrocë me susta. Sustat mbajnë një pjesë të peshës sate dhe të japin rezistencë, kështu lëvizja mbetet e kontrolluar dhe pa ndikim të fortë në nyje.',
    'No. The groups are small, and the instructor sets your springs, shows you the reformer and corrects your position throughout.':
      'Jo. Grupet janë të vogla, dhe instruktorja të rregullon sustat, të tregon reformerin dhe të korrigjon pozicionin gjatë gjithë klasës.',
    'How do I book?': 'Si rezervoj?',
    'Get your package at the studio or on WhatsApp and you receive a DUA code. With your email and that code, book your classes online or in the app; each booking shows until when cancelling is free.':
      'Merr paketën në studio ose në WhatsApp dhe merr një kod DUA. Me email-in dhe atë kod, rezervo klasat online ose në aplikacion; çdo rezervim tregon deri kur anulimi është falas.',
    'Ask about this offer': 'Pyet për ofertën',
    'Prices in Albanian lek. Message us to book, or book online from a package you already have.':
      'Çmimet në lekë. Na shkruaj për të rezervuar, ose rezervo online nga paketa që ke.',
    'Relaxing and deep-tissue massage, lymphatic drainage, body sculpting and neck-and-shoulder treatments, from 30 to 90 minutes. The full menu is on the':
      'Masazh relaksues dhe i thellë, drenazh limfatik, sculpt trupi dhe trajtime për qafën e shpatullat, nga 30 deri në 90 minuta. Menuja e plotë është te',
    'The map is just below; tap it and Google Maps takes you to the door. We are open Monday to Saturday, 07:00 to 21:00.':
      'Harta është pak më poshtë; prek atë dhe Google Maps të çon te dera. Jemi hapur nga e hëna në të shtunë, 07:00 deri 21:00.',
    'Instagram': 'Instagram',
    'Because I want to.': 'Sepse dua.',
    'Book': 'Rezervo',
    'Most popular': 'Më e zgjedhura',
    'Price coming soon': 'Çmimi së shpejti',

    /* ---- the spa page ---- */
    'Book a treatment': 'Rezervo një trajtim',
    'DUA Spa · Tirana': 'DUA Spa · Tiranë',
    'Massage and body treatments in warm, quiet rooms, a few steps from the reformer studio.':
      'Masazhe dhe trajtime trupi në dhoma të ngrohta e të qeta, pak hapa nga studio e reformerit.',
    'See the menu': 'Shiko menunë',
    'The menu': 'Menuja',
    'Treatments,': 'Trajtime,',
    'unhurried.': 'pa nxitim.',
    'Prices in Albanian lek. Book online, or message us if you are not sure which to choose.':
      'Çmimet në lekë. Rezervo online, ose na shkruaj nëse nuk je e sigurt cilin të zgjedhësh.',
    'The menu is loading.': 'Menuja po ngarkohet.',
    'The menu will be here shortly. Message us and we will send it to you.': 'Menuja do të jetë këtu së shpejti. Na shkruaj dhe ta dërgojmë.',
    'The same abdomen photographed before and after a treatment at DUA, in the same light':
      'I njëjti bark, i fotografuar para dhe pas një trajtimi në DUA, në të njëjtën dritë',
    'Before and after, at DUA, in the same light. Every body responds differently; this is one client, not a promise.':
      'Para dhe pas, në DUA, në të njëjtën dritë. Çdo trup reagon ndryshe; kjo është një kliente, jo një premtim.',
    'Packages that pair reformer classes with spa treatments are with the memberships.':
      'Paketat që bashkojnë klasat e reformerit me trajtimet spa janë te abonimet.',
    'From a short reset to the full ninety minutes.': 'Nga një pushim i shkurtër deri te nëntëdhjetë minutat e plota.',
    'Lymphatic drainage': 'Drenazh limfatik',
    'A gentle, rhythmic manual technique with light, even pressure.': 'Një teknikë manuale e butë dhe ritmike, me presion të lehtë e të njëtrajtshëm.',
    'Body sculpting': 'Sculpt trupi',
    'Firm, focused massage for the body’s contours.': 'Masazh i fortë dhe i fokusuar për konturet e trupit.',
    'Series': 'Seri',
    'The same treatment, booked as a set.': 'I njëjti trajtim, i rezervuar si set.',
    'Our longest treatment: a full relaxing massage with unhurried time for recovery.':
      'Trajtimi ynë më i gjatë: një masazh i plotë relaksues, me kohë pa nxitim për rikuperim.',
    'Slow, flowing strokes and an unhurried pace.': 'Lëvizje të ngadalta e të rrjedhshme, pa asnjë nxitim.',
    'Firmer, focused pressure where muscles hold tension.': 'Presion më i fortë e i fokusuar aty ku muskujt mbajnë tension.',
    'Neck, shoulders, upper back and scalp, where long desk days collect.': 'Qafa, shpatullat, shpina e sipërme dhe skalpi, aty ku mblidhen ditët e gjata në tavolinë.',
    'Light, rhythmic movements, slow and precise throughout.': 'Lëvizje të lehta e ritmike, të ngadalta dhe të sakta gjatë gjithë kohës.',
    'Firm, energetic strokes focused on the body’s contours.': 'Lëvizje të forta e energjike, të fokusuara në konturet e trupit.',

  };

  /* The title is set per language rather than translated as a string, so the
     brand name leads in both and the words people actually search for are in
     front. Keep these in step with <title> in index.html. */
  var TITLES = {
    en: 'Reformer Pilates in Tirana — DUA Pilates and Spa',
    sq: 'Reformer Pilates në Tiranë — DUA Pilates and Spa'
  };

  /* The page is served in English and switched to Albanian on load, so the head
     has to follow the body: a crawler that renders the page finds Albanian text
     under an English description otherwise, and so does anyone sharing the link. */
  var META = {
    en: {
      description: 'Reformer Pilates and spa in Tirana. Small classes on the reformer, private sessions, and massage and body treatments in the same studio.',
      ogTitle: 'DUA — Reformer Pilates and Spa in Tirana',
      ogDescription: 'Movement, recovery and a little time just for you. A boutique reformer Pilates studio and spa in Tirana.',
      locale: 'en_GB',
      altLocale: 'sq_AL'
    },
    sq: {
      description: 'Reformer Pilates dhe spa në Tiranë. Klasa të vogla në reformer, seanca private, dhe masazhe e trajtime trupi në të njëjtin studio.',
      ogTitle: 'DUA — Reformer Pilates dhe Spa në Tiranë',
      ogDescription: 'Lëvizje, rikuperim dhe pak kohë vetëm për ty. Një studio boutique e reformer Pilates dhe spa në Tiranë.',
      locale: 'sq_AL',
      altLocale: 'en_GB'
    }
  };

  function meta(sel, value) {
    var el = document.head.querySelector(sel);
    if (el && el.getAttribute('content') !== value) el.setAttribute('content', value);
  }

  var DAYS = {
    Monday: 'E hënë', Tuesday: 'E martë', Wednesday: 'E mërkurë', Thursday: 'E enjte',
    Friday: 'E premte', Saturday: 'E shtunë', Sunday: 'E diel'
  };

  /* Patterned strings the dictionary would otherwise have to list one by one. */
  function pattern(s) {
    var m = s.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d{1,2}) Sep · (\d{2}:\d{2})$/);
    if (m) return DAYS[m[1]] + ' ' + m[2] + ' Sht · ' + m[3];
    m = s.match(/^(\d+) spots? left$/);
    if (m) return m[1] === '1' ? '1 vend i lirë' : m[1] + ' vende të lira';
    /* The money lines on the packages carry a figure, so they are matched
       rather than listed: one entry would otherwise be needed per price. */
    m = s.match(/^Question (\d+) of (\d+)$/);
    if (m) return 'Pyetja ' + m[1] + ' nga ' + m[2];
    m = s.match(/^Saves ([\d,]+ L)$/);
    if (m) return 'Kursen ' + m[1];
    m = s.match(/^Worth ([\d,]+ L) — you save ([\d,]+ L)$/);
    if (m) return 'Vlera ' + m[1] + ' — kursen ' + m[2];
    m = s.match(/^([\d,]+ L) \/ class$/);
    if (m) return m[1] + ' / klasë';
    /* Packages the studio enters herself carry counts this file cannot
       have listed: how many treatments, and what a combination holds. */
    m = s.match(/^· (\d+) treatments?$/);
    if (m) return '· ' + m[1] + (m[1] === '1' ? ' trajtim' : ' trajtime');
    m = s.match(/^Until (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)$/);
    if (m) return 'Deri më ' + m[1] + ' ' + { January: 'janar', February: 'shkurt', March: 'mars', April: 'prill', May: 'maj', June: 'qershor',
      July: 'korrik', August: 'gusht', September: 'shtator', October: 'tetor', November: 'nëntor', December: 'dhjetor' }[m[2]];
    m = s.match(/^(\d+) places? left$/);
    if (m) return m[1] === '1' ? 'Edhe 1 vend' : 'Edhe ' + m[1] + ' vende';
    m = s.match(/^(\d+) treatments$/);
    if (m) return m[1] + ' trajtime';
    m = s.match(/^(\d+) times$/);
    if (m) return m[1] + ' orare';
    m = s.match(/^(\d+) Pilates \+ (\d+) Spa$/);
    if (m) return m[1] + ' Pilates + ' + m[2] + ' Spa';
    return null;
  }

  function translate(s) {
    if (Object.prototype.hasOwnProperty.call(SQ, s)) return SQ[s];
    return pattern(s);
  }

  /* --------------------------------------------------------- */
  var ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];
  var SKIP = { SCRIPT: 1, STYLE: 1, CANVAS: 1, NOSCRIPT: 1 };
  var mo;
  var originals = new WeakMap();      // text node -> English
  var lang = 'en';
  var busy = false;                   // our own writes must not re-trigger the observer

  function walk(root, toSQ) {
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.parentNode || SKIP[n.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        if (n.nodeValue.trim()) return NodeFilter.FILTER_ACCEPT;
        // A word that drops out in Albanian leaves a blank node behind; it still
        // has to be visited on the way back or the English never returns.
        return (!toSQ && originals.has(n)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = tw.nextNode())) nodes.push(n);

    nodes.forEach(function (node) {
      if (toSQ) {
        var en = originals.has(node) ? originals.get(node) : node.nodeValue;
        var host = node.parentElement;
        var override = host && host.getAttribute && host.childNodes.length === 1
          ? host.getAttribute('data-sq') : null;
        var out = override !== null && override !== undefined ? override : translate(en.trim());
        if (out === null || out === undefined) return;
        originals.set(node, en);
        // keep the original leading/trailing whitespace so inline layout holds
        var next = en.replace(en.trim(), out);
        if (node.nodeValue !== next) node.nodeValue = next;
      } else if (originals.has(node)) {
        node.nodeValue = originals.get(node);
        originals.delete(node);
      }
    });

    var els = root.querySelectorAll ? root.querySelectorAll('*') : [];
    Array.prototype.forEach.call(els, function (el) {
      ATTRS.forEach(function (a) {
        var stash = 'data-en-' + a;
        if (toSQ) {
          var en = el.getAttribute(stash) || el.getAttribute(a);
          if (!en) return;
          var out = translate(en);
          if (out === null) return;
          el.setAttribute(stash, en);
          if (el.getAttribute(a) !== out) el.setAttribute(a, out);
        } else if (el.hasAttribute(stash)) {
          el.setAttribute(a, el.getAttribute(stash));
          el.removeAttribute(stash);
        }
      });
    });
  }

  function apply(next) {
    lang = next;
    busy = true;
    walk(document.body, next === 'sq');
    document.documentElement.lang = next === 'sq' ? 'sq' : 'en';
    /* A page other than the homepage carries its own title and description
       on <html data-title-en … data-desc-sq>. */
    var root = document.documentElement;
    var own = root.getAttribute('data-title-' + next);
    document.title = own || TITLES[next] || TITLES.en;
    var m = META[next] || META.en;
    if (own) m = { description: root.getAttribute('data-desc-' + next) || '', ogTitle: own,
      ogDescription: root.getAttribute('data-desc-' + next) || '', locale: m.locale, altLocale: m.altLocale };
    meta('meta[name="description"]', m.description);
    meta('meta[property="og:title"]', m.ogTitle);
    meta('meta[property="og:description"]', m.ogDescription);
    meta('meta[name="twitter:title"]', m.ogTitle);
    meta('meta[name="twitter:description"]', m.ogDescription);
    meta('meta[property="og:locale"]', m.locale);
    meta('meta[property="og:locale:alternate"]', m.altLocale);
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      var on = b.getAttribute('data-lang') === next;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try { localStorage.setItem('dua-lang', next); } catch (e) { }
    if (mo) mo.takeRecords();          // discard the records we just caused
    busy = false;
  }


  /* Text injected later — the class panel, the membership tier switcher, the
     booking confirmation — arrives in English and is translated on the way in. */
  if (window.MutationObserver) {
    mo = new MutationObserver(function (records) {
      if (busy || lang !== 'sq') return;
      busy = true;
      records.forEach(function (r) {
        if (r.type === 'characterData') { walk(r.target.parentNode || document.body, true); return; }
        Array.prototype.forEach.call(r.addedNodes, function (n) {
          if (n.nodeType === 1) walk(n, true);
          else if (n.nodeType === 3 && n.parentNode) walk(n.parentNode, true);
        });
      });
      busy = false;
    });
    mo.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (!b) return;
    e.preventDefault();
    apply(b.getAttribute('data-lang'));
  });

  var saved = null;
  try { saved = localStorage.getItem('dua-lang'); } catch (e) { }
  apply(saved === 'en' ? 'en' : 'sq');   // Albanian is the default
})();
