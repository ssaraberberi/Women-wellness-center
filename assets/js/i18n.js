/* ============================================================
   Beci — English / Albanian
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
    'Explore the studio': 'Zbulo studion',
    'Scroll': 'Zbrit',
    'Beci, home': 'Beci, faqja kryesore',
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
    'Movement & recovery studio': 'Studio lëvizjeje & rikuperimi',
    'Reformer · Barre · Yoga · Massage': 'Reformer · Barre · Yoga · Masazh',
    'Mon–Fri 07:00–21:30': 'Hën–Pre 07:00–21:30',
    'Sat 08:30–15:00': 'Sht 08:30–15:00',
    'Sun 09:00–19:00': 'Die 09:00–19:00',
    'Mon–Fri 07:00 – 21:30': 'Hën–Pre 07:00 – 21:30',
    'Sat 08:30 – 15:00': 'Sht 08:30 – 15:00',
    'Sun 09:00 – 19:00': 'Die 09:00 – 19:00',

    /* ---- hero ---- */
    'Move like': 'Lëvize trupin',
    'you mean it.': 'me bindje.',
    'Move like you mean it': 'Lëvize trupin me bindje',
    'Eight women per class': 'Tetë gra për klasë',

    /* ---- the idea ---- */
    'The idea': 'Ideja',
    'The best hour': 'Ora më e mirë',
    'of your': 'e javës',
    'week.': 'sate.',
    'The main floor, 17:40': 'Salla kryesore, 17:40',
    'Beci is small on purpose. Eight women, one instructor who knows your name and exactly which shoulder gives you trouble.':
      'Beci është i vogël me qëllim. Tetë gra, një instruktore që e di emrin tënd dhe saktësisht cila shpatull të bezdis.',
    'Reformer, barre, yoga and massage in one place, so you stop choosing between getting strong and actually resting. Come straight from work in whatever you have on. Nobody is looking at you — everyone is busy shaking.':
      'Reformer, barre, yoga dhe masazh në një vend, që të mos zgjedhësh më mes forcimit dhe pushimit të vërtetë. Eja direkt nga puna, me çfarë ke veshur. Askush nuk të shikon — të gjitha janë të zëna duke u dridhur.',
    'Then there is the part nobody puts on a website: the bench by the window, the coffee afterwards, and the forty minutes you spend there talking instead of going home.':
      'Pastaj vjen pjesa që askush nuk e vë në faqe interneti: stoli te dritarja, kafeja pas klase dhe dyzet minutat që kalon aty duke folur, në vend që të shkosh në shtëpi.',
    'See what a month looks like': 'Shih si duket një muaj',
    'Corrections, every class': 'Korrigjime, në çdo klasë',
    'women per class': 'gra për klasë',
    'reformers': 'reformerë',
    'first class of the day': 'klasa e parë e ditës',
    'from Sheshi Wilson': 'nga Sheshi Wilson',

    /* ---- four rituals ---- */
    'Four rituals': 'Katër ritualet',
    'Explore': 'Zbulo',
    'Strength you can feel in the way you stand.': 'Forcë që e ndien te mënyra si qëndron.',
    'Small moves. Serious shake.': 'Lëvizje të vogla. Dridhje serioze.',
    'The part of the day that belongs to you.': 'Pjesa e ditës që të takon ty.',
    "Recovery isn't a reward. It's the work.": 'Rikuperimi s’është shpërblim. Është pjesë e punës.',

    /* ---- reformer ---- */
    'The signature': 'Klasika jonë',
    'Strong.': 'E fortë.',
    'On purpose.': 'Me qëllim.',
    'Six reformers, eight women, forty-five minutes. Slow enough that it looks easy from the doorway, hard enough that you feel it every time you sit down on Thursday.':
      'Gjashtë reformerë, tetë gra, dyzet e pesë minuta. Aq ngadalë sa duket e lehtë nga dera, aq fort sa e ndien sa herë ulesh të enjten.',
    'Strength.': 'Forcë.',
    'Progressive spring resistance that builds real capacity — without ever pounding your joints.':
      'Rezistencë progresive me suste që ndërton kapacitet të vërtetë — pa ia rënë kurrë kyçeve.',
    'Control.': 'Kontroll.',
    'Every repetition is slow enough that you feel exactly which muscle is doing the work.':
      'Çdo përsëritje është aq e ngadaltë sa e ndien saktësisht cili muskul po punon.',
    'Posture.': 'Qëndrim.',
    'Deep core and back work that undoes eight hours at a desk, one class at a time.':
      'Punë e thellë për bërthamën dhe shpinën, që zhbën tetë orë në tavolinë, një klasë pas tjetrës.',
    'Confidence.': 'Vetëbesim.',
    'You will never be the one quietly copying everybody else. We show you the machine first.':
      'Nuk do të jesh kurrë ajo që kopjon të tjerat në heshtje. Së pari të tregojmë makinerinë.',
    'Movement.': 'Lëvizje.',
    'Mobility you keep — in the way you walk, lift, sit and carry yourself through Tirana.':
      'Lëvizshmëri që të mbetet — te mënyra si ecën, ngre, ulesh dhe mbahesh nëpër Tiranë.',
    'Small groups': 'Grupe të vogla',
    'Maximum eight women, six reformers, one instructor who watches all of you.':
      'Maksimumi tetë gra, gjashtë reformerë, një instruktore që ju sheh të gjithave.',
    'Beginner-friendly': 'Mikpritëse për fillestaret',
    'A free 30-minute foundations session before your first group class.':
      'Një seancë bazë 30-minutëshe falas para klasës sate të parë në grup.',
    'Hands-on': 'Korrigjime në vend',
    "Personal corrections in every single class. That's the whole point.":
      'Korrigjime personale në çdo klasë. Pikërisht kjo është poenta.',
    'Built for life': 'Për jetën e përditshme',
    'Posture, mobility, control and a back that stops complaining.':
      'Qëndrim, lëvizshmëri, kontroll dhe një shpinë që pushon së ankuari.',
    'Explore Reformer': 'Zbulo Reformer',
    'Free foundations session for every new member': 'Seancë bazë falas për çdo anëtare të re',

    /* ---- barre + yoga ---- */
    'Movement': 'Lëvizja',
    'Small moves.': 'Lëvizje të vogla.',
    'Serious shake.': 'Dridhje serioze.',
    'Ballet-adjacent, low impact, genuinely evil. Forty-five minutes of movements about one centimetre wide. Your legs will shake. That is the point, and everyone else is shaking too.':
      'Afër baletit, me ndikim të ulët, vërtet e pamëshirshme. Dyzet e pesë minuta lëvizjesh rreth një centimetër të gjera. Këmbët do të dridhen. Pikërisht kjo është poenta — dhe po dridhen edhe të gjitha të tjerat.',
    'All levels': 'Të gjitha nivelet',
    'Mon · Wed · Fri': 'Hën · Mër · Pre',
    'Book barre': 'Rezervo barre',
    'Your phone': 'Telefoni',
    'stays outside.': 'mbetet jashtë.',
    'Vinyasa at 07:30 while the light is still low. Slow flow and restorative in the evening, when the city is loud and you would rather not be. Candlelit on Sundays, and nobody will make you chant.':
      'Vinyasa në 07:30, sa kohë drita është ende e ulët. Slow flow dhe restorative në mbrëmje, kur qyteti bën zhurmë dhe ti jo. Me qirinj të dielave — dhe askush nuk do të të vërë të këndosh mantra.',
    'Vinyasa · Slow · Restorative': 'Vinyasa · Slow · Restorative',
    'Daily': 'Çdo ditë',
    'Book yoga': 'Rezervo yoga',

    /* ---- recovery ---- */
    'Recovery': 'Rikuperimi',
    'You’ve earned': 'E ke merituar',
    'the': '',
    'dark room.': 'dhomën e errët.',
    'Two rooms at the back, kept deliberately dark and a little too warm. Book one on its own, or tack it onto a class and leave the building a genuinely different person.':
      'Dy dhoma në fund, me qëllim të errëta dhe pak më të ngrohta se ç’duhet. Rezervo vetëm masazhin, ose shtoje pas një klase dhe dil nga ndërtesa vërtet një njeri tjetër.',
    'Deep tissue': 'Masazh i thellë',
    'Sports & post-training recovery': 'Sportiv & rikuperim pas stërvitjes',
    'Lymphatic drainage': 'Drenazh limfatik',
    'Aromatherapy & deep rest': 'Aromaterapi & pushim i thellë',
    'Explore treatments': 'Zbulo trajtimet',

    /* ---- schedule ---- */
    'The week': 'Java',
    'This week': 'Këtë javë',
    'at': 'te',
    'Beci.': 'Beci.',
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
    'Find your': 'Gjej abonimin',
    'membership.': 'tënd.',
    'No contracts, no joining fee. Pause any month, and classes roll over thirty days — because some weeks in Tirana are simply not yours.':
      'Pa kontrata, pa tarifë anëtarësimi. Ndale çdo muaj, dhe klasat kalojnë tridhjetë ditë më tej — sepse disa javë në Tiranë thjesht nuk janë tuajat.',
    '8 classes / month': '8 klasa / muaj',
    '12 classes / month': '12 klasa / muaj',
    '16 classes / month': '16 klasa / muaj',
    'Small-group reformer, max 8': 'Reformer në grup të vogël, maks. 8',
    'Free foundations session': 'Seancë bazë falas',
    'Classes roll over 30 days': 'Klasat kalojnë 30 ditë më tej',
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

    /* ---- the space ---- */
    'The space': 'Hapësira',
    'Top floor of a 1930s building a minute off the square — high ceilings, deep windows, and the kind of afternoon light you cannot install. Lime plaster, oak, linen, and a shower room stocked properly, so you can come straight from the office and go straight out afterwards.':
      'Kati i fundit i një ndërtese të viteve ’30, një minutë nga sheshi — tavane të larta, dritare të thella dhe ajo drita e pasdites që nuk instalohet dot. Suva gëlqereje, lis, liri dhe një dhomë dushi e pajisur si duhet, që të vish direkt nga zyra dhe të dalësh direkt pas klase.',
    'The reformer room': 'Salla e reformerëve',
    'Changing rooms': 'Dhomat e zhveshjes',
    'The mat studio': 'Salla e dyshekëve',
    'Your locker': 'Dollapi yt',
    'The washroom': 'Lavamanët',

    /* ---- voices ---- */
    'In their words': 'Me fjalët e tyre',
    '“I have cancelled dinner for this. Twice. I would do it again.”':
      '“Kam anuluar darkën për këtë. Dy herë. Do ta bëja sërish.”',
    'Sara, 27 — architect': 'Sara, 27 — arkitekte',
    '“I came for the reformer. I stayed for the forty-five minutes where nobody needs anything from me.”':
      '“Erdha për reformerin. Mbeta për dyzet e pesë minutat ku askush nuk ka nevojë për asgjë prej meje.”',
    'Enkelejda, 34 — dentist': 'Enkelejda, 34 — dentiste',
    '“My posture changed before my body did. Then my body did too.”':
      '“Qëndrimi më ndryshoi para trupit. Pastaj ndryshoi edhe trupi.”',
    'Kejsi, 29 — product designer': 'Kejsi, 29 — dizajnere produkti',
    '“Class, shower, coffee downstairs, home. The only part of my week that goes exactly to plan.”':
      '“Klasë, dush, kafe poshtë, shtëpi. E vetmja pjesë e javës që shkon saktësisht sipas planit.”',
    'Ana, 31 — works around the corner': 'Ana, 31 — punon aty pranë',

    /* ---- community + final ---- */
    'Follow along': 'Na ndiq',
    'Thursday, 19:00': 'E enjte, 19:00',
    'Coffee, downstairs': 'Kafe, poshtë',
    'New socks, new set': 'Çorape të reja, set i ri',
    'Sunday, slow': 'E diel, ngadalë',
    'Candlelit flow': 'Flow me qirinj',
    'Recovery day': 'Ditë rikuperimi',
    'See you': 'Shihemi',
    'Thursday.': 'të enjten.',
    'Book your first class': 'Rezervo klasën tënde të parë',
    'First class 990 ALL · Sheshi Wilson, Tiranë': 'Klasa e parë 990 ALL · Sheshi Wilson, Tiranë',

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

    /* ---- alt text ---- */
    'Two women kneeling on reformers, arms overhead in the straps, in front of sheer curtains':
      'Dy gra në gjunjë mbi reformerë, krahët lart në rripa, para perdeve të tejdukshme',
    'Wide view of the studio: reformers, arched alcoves and warm ivory walls':
      'Pamje e gjerë e studios: reformerë, harqe dhe mure të ngrohta ngjyrë fildishi',
    'Close-up of hands adjusting a reformer strap': 'Afër: duart duke rregulluar rripin e reformerit',
    'A woman holding a long plank on a reformer': 'Një grua duke mbajtur plank të gjatë mbi reformer',
    'Legs extended along the barre during class': 'Këmbë të shtrira përgjatë barres gjatë klasës',
    'A woman arching backwards in a slow yoga shape': 'Një grua duke u përkulur pas në një formë të ngadaltë yoga',
    'Hands working across a back during a deep tissue massage': 'Duar që punojnë mbi shpinë gjatë një masazhi të thellë',
    'A woman reaching overhead in a side position on the reformer': 'Një grua që shtrihet lart anash mbi reformer',
    'A barre class working through leg extensions at the bar': 'Një klasë barre duke punuar shtrirjet e këmbëve te shufra',
    'A yoga class moving through a standing side bend': 'Një klasë yoga duke kaluar në përkulje anësore në këmbë',
    'Hands working slowly across a back during a treatment': 'Duar që punojnë ngadalë mbi shpinë gjatë një trajtimi',
    'A quiet, warm treatment corridor': 'Një korridor i qetë dhe i ngrohtë trajtimesh',
    'The reformer room, with pink carriages along the arched windows':
      'Salla e reformerëve, me karroca rozë përgjatë dritareve me harqe',
    'The changing room in pink tile, with a backlit oval mirror':
      'Dhoma e zhveshjes me pllaka rozë dhe një pasqyrë ovale e ndriçuar',
    'The mat studio, arches and mirrors lit in pink, mats laid out with rings and balls':
      'Salla e dyshekëve, harqe dhe pasqyra të ndriçuara rozë, dyshekë të shtruar me unaza dhe topa',
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

    /* ---- document ---- */
    'Beci — Reformer Pilates, Barre, Yoga & Massage · Sheshi Wilson, Tiranë':
      'Beci — Reformer Pilates, Barre, Yoga & Masazh · Sheshi Wilson, Tiranë'
  };

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
    var t = translate(document.title);
    if (next === 'sq' && t) document.title = t;
    if (next === 'en' && titleEN) document.title = titleEN;
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      var on = b.getAttribute('data-lang') === next;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try { localStorage.setItem('beci-lang', next); } catch (e) {}
    if (mo) mo.takeRecords();          // discard the records we just caused
    busy = false;
  }

  var titleEN = document.title;

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
  try { saved = localStorage.getItem('beci-lang'); } catch (e) {}
  apply(saved === 'sq' ? 'sq' : 'en');
})();
