/* ============================================================
   DUA — booking a class
   ------------------------------------------------------------
   Pick a day and a time, write who you are, enter the code we
   email you: booked. No account to make, no password, nothing to
   pay now — one class is paid at the studio, in cash.

   Everything is decided by the same server the app uses (the
   meta tag "dua-api" names it): places, the price, the code, the
   cancellation rule. The page only asks and shows the answer, so
   a booking made here is in the app and at the desk at once.

   Proving the email signs her in on this browser. Next time she
   books without a code, and with sessions in a package she
   chooses whether to use one. A guest's private link (#manage=…,
   after the hash so no server ever logs it) opens one booking.
   ============================================================ */

const STUDIO_WA = '355697104072';
const SESSION_KEY = 'dua-web-session';

/* The server: from the page, or ?api= when trying it on this machine. */
const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const asked = local ? new URLSearchParams(location.search).get('api') : null;
  try { if (asked) sessionStorage.setItem('dua-api', asked); } catch (e) {}
  let kept = null;
  try { kept = local ? sessionStorage.getItem('dua-api') : null; } catch (e) {}
  return (asked || kept || document.querySelector('meta[name="dua-api"]').content).replace(/\/$/, '');
})();

/* ---------- words ---------- */
const SQ = {
  'Book a class': 'Rezervo një klasë', 'Your details': 'Të dhënat e tua', 'Check your email': 'Shiko email-in',
  'Booked': 'U rezervua', 'Step %s of %s': 'Hapi %s nga %s',
  'Pick a day, then a time.': 'Zgjidh një ditë, pastaj orën.',
  'Single class': 'Klasë e vetme', 'paid at the studio, in cash': 'paguhet në studio, me cash',
  'Previous month': 'Muaji i kaluar', 'Next month': 'Muaji tjetër', 'Free places': 'Vende të lira', 'Full': 'Plot',
  '%s places': '%s vende', '1 place': '1 vend', 'with %s': 'me %s', 'In progress': 'Po zhvillohet',
  'Nothing on this day.': 'Asgjë këtë ditë.',
  'No classes are open for booking yet. Message us and we will save you a place.': 'Ende nuk ka klasa të hapura për rezervim. Na shkruaj dhe të ruajmë një vend.',
  'Continue': 'Vazhdo', 'Back': 'Kthehu', 'One moment…': 'Një moment…',
  'First name': 'Emri', 'Last name': 'Mbiemri', 'Phone number': 'Numri i telefonit', 'Email': 'Email',
  'We send you a code to confirm, then your booking.': 'Të dërgojmë një kod për ta konfirmuar, pastaj rezervimin.',
  'Send me the code': 'Më dërgo kodin',
  'We sent a 6-digit code to %s. It expires in 10 minutes.': 'Të dërguam një kod 6-shifror te %s. Skadon pas 10 minutash.',
  'Code': 'Kodi', 'Confirm booking': 'Konfirmo rezervimin', 'Send a new code': 'Më dërgo kod të ri', 'New code in %s s': 'Kod i ri pas %s s',
  'Wrong email? Go back': 'Email i gabuar? Kthehu',
  'Class': 'Klasa', 'Date': 'Data', 'Time': 'Ora', 'Instructor': 'Instruktorja', 'To pay': 'Për të paguar',
  'Payment': 'Pagesa', 'Reference': 'Referenca', 'Status': 'Statusi', 'From your package': 'Nga paketa jote',
  'At the studio, in cash': 'Në studio, me cash', 'Paid': 'Paguar', 'Not paid yet': 'Pa paguar ende', 'Not owed': 'Nuk detyrohet',
  'Cancellation Policy': 'Politika e anulimit',
  'Free cancellation until %s hour before the class. Cancelling later, or not coming, the class is still due.':
    'Anulim falas deri %s orë para klasës. Nëse anulon më vonë, ose nuk vjen, klasa paguhet.',
  'See you there, %s!': 'Të presim, %s!',
  'Your place is confirmed. You pay at the studio, in cash.': 'Vendi yt është i konfirmuar. Paguan në studio, me cash.',
  'Your place is confirmed.': 'Vendi yt është i konfirmuar.',
  'We emailed you a private link to see or cancel it.': 'Të dërguam me email një link privat për ta parë ose anuluar.',
  'Free cancellation until %s.': 'Anulim falas deri: %s.',
  'Book another class': 'Rezervo një klasë tjetër', 'My bookings': 'Rezervimet e mia', 'Back to the website': 'Kthehu te faqja',
  'You have %s sessions in your package': 'Ke %s seanca në paketë', 'You have 1 session in your package': 'Ke 1 seancë në paketë',
  'How do you want to book it?': 'Si do ta rezervosh?',
  'Use 1 session from my package': 'Përdor 1 seancë nga paketa', '%s left after this': 'Të mbeten %s pas kësaj',
  'Book it as a single class': 'Rezervoje si klasë e vetme', '%s, paid at the studio': '%s, paguhet në studio',
  'Confirm: %s': 'Konfirmo: %s',
  'Signed in as': 'Je brenda si', 'Not you? Sign out': 'Nuk je ti? Dil',
  'Your booking': 'Rezervimi yt', 'Cancel booking': 'Anulo rezervimin', 'Tap again to cancel': 'Shtyp sërish për ta anuluar',
  'Cancelling now is free.': 'Anulimi tani është falas.',
  'It is past the free cancellation time: if you cancel, the class is still due.': 'Ka kaluar afati i anulimit falas: nëse anulon, klasa paguhet njësoj.',
  'Cancelled. You owe nothing.': 'U anulua. Nuk detyrohesh asgjë.',
  'Cancelled. The session is back in your package.': 'U anulua. Seanca u kthye në paketë.',
  'Cancelled late: the class is still due.': 'U anulua me vonesë: klasa paguhet njësoj.',
  'Reserved': 'E rezervuar', 'Cancelled': 'Anuluar', 'Cancelled late': 'Anuluar me vonesë', 'Cancelled by the studio': 'Anuluar nga studioja',
  'No upcoming classes.': 'Asnjë klasë në vijim.',
  'This link does not open a booking any more. Ask the studio, or book again.': 'Ky link nuk hap më asnjë rezervim. Pyet studion, ose rezervo sërish.',
  'Message the studio': 'Shkruaji studios',
  /* What the server says, by code */
  'OTP_INVALID': 'Kodi nuk është i saktë.', 'OTP_EXPIRED': 'Kodi ka skaduar. Kërko një të ri.', 'OTP_LOCKED': 'Shumë kode të gabuara. Kërko një të ri.',
  'RATE_LIMITED': 'Shumë kërkesa. Provo sërish pas pak.', 'CLASS_FULL': 'Kjo klasë sapo u mbush. Zgjidh një orë tjetër.',
  'CLASS_STARTED': 'Kjo klasë ka filluar.', 'CLASS_CANCELLED': 'Kjo klasë nuk pranon më rezervime.', 'STUDIO_CLOSED': 'Studioja është e mbyllur atë ditë.',
  'ALREADY_BOOKED': 'E ke tashmë një vend në këtë klasë.', 'SINGLE_PRICE_MISSING': 'Rezervimi online nuk është i hapur tani. Na shkruaj në WhatsApp.',
  'STAFF_ACCOUNT': 'Ky email është i stafit: hyr në aplikacion.', 'VALIDATION': 'Kontrollo të dhënat: numri i telefonit duhet të jetë i plotë.',
  'BOOKING_NOT_OPEN': 'Rezervimet për këtë datë nuk janë hapur ende.', 'CANCEL_CLOSED': 'Klasa ka filluar, nuk anulohet më.',
  'NETWORK': 'Nuk u lidhëm dot. Kontrollo internetin dhe provo sërish.', 'UNKNOWN': 'Diçka shkoi keq. Provo sërish.',
  'Write your first name': 'Shkruaj emrin', 'Write your last name': 'Shkruaj mbiemrin',
  'Write a phone number we can call': 'Shkruaj një numër telefoni ku të marrim', 'That email does not look right': 'Ky email nuk duket i saktë',
  'The code has 6 digits': 'Kodi ka 6 shifra',
  'Packages & offers': 'Paketa & oferta', 'Offers': 'Oferta', 'Packages': 'Paketa',
  'Reserve now, pay at the studio in cash. Your sessions start as soon as it is paid.': 'Rezervoje tani, paguaj në studio me cash. Seancat nisin sapo të paguhet.',
  '1 class': '1 klasë', '%s classes': '%s klasa', 'valid %s days': 'vlen %s ditë', 'for two': 'për dy', '%s left': 'Kanë mbetur %s',
  '%s off': '%s ulje', '+%s bonus class with a friend': '+%s klasë bonus me një shoqe', 'New clients': 'Për kliente të reja',
  'Your email': 'Email-i yt', 'We send you a code — no password needed.': 'Të dërgojmë një kod — pa fjalëkalim.',
  'First time at DUA: tell us who you are.': 'Herën e parë te DUA: na thuaj kush je.',
  'Classes': 'Klasa', 'Valid': 'Vlefshmëria', '%s days from payment': '%s ditë nga pagesa', 'Regular price': 'Çmimi i rregullt', 'Bonus': 'Bonus',
  '+%s class for you and your friend when she pays for her own package': '+%s klasë për ty dhe shoqen, kur ajo paguan paketën e saj',
  'Your DUO partner': 'Partnerja jote e DUO-s', 'Your friend': 'Shoqja jote',
  'She gets her own package with the same classes; you book your classes together.': 'Merr paketën e saj me të njëjtat klasa; klasat i rezervoni bashkë.',
  'She must be new to DUA. Your bonus comes when she pays for a package of her own.': 'Duhet të jetë e re në DUA. Bonusi vjen kur ajo paguan paketën e saj.',
  'How it works': 'Si funksionon', 'Your package is reserved now. Pay at the studio, in cash; your sessions start as soon as it is paid.': 'Paketa rezervohet tani. Paguan në studio me cash; seancat nisin sapo të paguhet.',
  'Reserve the package': 'Rezervo paketën', 'Write the full name of the other person': 'Shkruaj emrin e plotë të personit tjetër',
  'Reserved': 'U rezervua', 'Package': 'Paketa', 'With': 'Me',
  'Show the reference at the studio. Your sessions start as soon as it is paid.': 'Trego referencën në studio. Seancat nisin sapo të paguhet.',
  'Book for both of us (DUO)': 'Rezervo për të dyja (DUO)', 'With %s · two places, a session from each package': 'Me %s · dy vende, një seancë nga secila paketë',
  'See you both there, %s and %s!': 'Ju presim të dyja, %s dhe %s!',
  'OFFER_USED': 'E ke përdorur tashmë këtë ofertë.', 'OFFER_LIMIT': 'Kjo ofertë ka arritur kufirin.', 'OFFER_UNAVAILABLE': 'Kjo ofertë nuk është më e disponueshme.',
  'OFFER_NEW_ONLY': 'Kjo ofertë është për kliente të reja.', 'OFFER_NOT_APPLICABLE': 'Kjo ofertë nuk zbatohet për këtë paketë.',
  'FRIEND_NOT_NEW': 'Shoqja jote ka qenë tashmë në DUA, ndaj oferta nuk zbatohet.', 'ORDER_PENDING': 'Këtë paketë e ke tashmë në pritje të pagesës.',
  'TRIAL_NOT_ELIGIBLE': 'Kjo paketë është për kliente të reja.', 'NO_DUO': 'Nuk ka paketë DUO me klasa për të dyja.',
  'DUO_TOGETHER': 'DUO-ja juaj rezervohet bashkë: zgjidh "Rezervo për të dyja".', 'REGISTRATION_EXPIRED': 'Koha skadoi. Fillo sërish.'
};
const EN = {
  OTP_INVALID: 'That code is not right.', OTP_EXPIRED: 'The code expired. Ask for a new one.', OTP_LOCKED: 'Too many wrong codes. Ask for a new one.',
  RATE_LIMITED: 'Too many requests. Try again in a little while.', CLASS_FULL: 'That class has just filled up. Pick another time.',
  CLASS_STARTED: 'This class has already started.', CLASS_CANCELLED: 'This class is not taking bookings.', STUDIO_CLOSED: 'The studio is closed that day.',
  ALREADY_BOOKED: 'You already have a place in this class.', SINGLE_PRICE_MISSING: 'Online booking is not open right now. Message us on WhatsApp.',
  STAFF_ACCOUNT: 'This email belongs to the staff: sign in in the app.', VALIDATION: 'Check your details: the phone number must be complete.',
  BOOKING_NOT_OPEN: 'Booking for this date is not open yet.', CANCEL_CLOSED: 'The class has started, it can no longer be cancelled.',
  NETWORK: 'We could not connect. Check your internet and try again.', UNKNOWN: 'Something went wrong. Try again.',
  OFFER_USED: 'You have already used this offer.', OFFER_LIMIT: 'This offer has reached its limit.', OFFER_UNAVAILABLE: 'This offer is no longer available.',
  OFFER_NEW_ONLY: 'This offer is for new clients.', OFFER_NOT_APPLICABLE: 'This offer does not apply to that package.',
  FRIEND_NOT_NEW: 'Your friend has already been to DUA, so this offer does not apply.', ORDER_PENDING: 'You already have this package waiting for payment.',
  TRIAL_NOT_ELIGIBLE: 'This package is for new clients.', NO_DUO: 'There is no DUO package with classes for both of you.',
  DUO_TOGETHER: 'Your DUO is booked together: choose "Book for both of us".', REGISTRATION_EXPIRED: 'That took too long. Start again.'
};
const DAYS = { sq: ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const DAYS3 = { sq: ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'], en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] };
const MONTHS = { sq: ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'],
                 en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };

let lang = 'sq';
try { lang = localStorage.getItem('dua-lang') === 'en' ? 'en' : 'sq'; } catch (e) {}
function t(key, ...args) {
  let s = lang === 'sq' ? (SQ[key] !== undefined ? SQ[key] : key) : (EN[key] !== undefined ? EN[key] : key);
  args.forEach(a => { s = s.replace('%s', a); });
  return s;
}

/* ---------- dates, always in the studio's timezone ---------- */
const tirana = iso => {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).forEach(x => { p[x.type] = x.value; });
  return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
};
const day = d => new Date(d + 'T12:00:00');
const plusDays = (d, n) => { const x = day(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const longDate = d => { const x = day(d); return lang === 'sq' ? DAYS.sq[x.getDay()] + ', ' + x.getDate() + ' ' + MONTHS.sq[x.getMonth()] : DAYS.en[x.getDay()] + ', ' + MONTHS.en[x.getMonth()] + ' ' + x.getDate(); };
const whenShort = iso => { const z = tirana(iso); return longDate(z.date) + ' · ' + z.time; };
const money = n => Number(n).toLocaleString('en-US') + ' L';

/* ---------- a small DOM helper ---------- */
function h(tag, attrs, kids) {
  const [name, ...cls] = tag.split('.');
  const n = document.createElement(name || 'div');
  if (cls.length) n.className = cls.join(' ');
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className += (n.className ? ' ' : '') + v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'value') n.value = v;
    else if (k === 'disabled' || k === 'hidden') n[k] = !!v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(c => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return n;
}
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const icon = svg => { const s = h('span'); s.innerHTML = svg; return s.firstChild; };

/* ---------- talking to the server ---------- */
const newKey = () => Date.now().toString(36) + '-' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');

/* Signed in on this browser: the refresh token is kept, the access token only in memory. */
const auth = { access: null, refreshing: null };
const savedRefresh = () => { try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; } };
const keepSession = s => { auth.access = s.accessToken; try { localStorage.setItem(SESSION_KEY, s.refreshToken); } catch (e) {} };
const forgetSession = () => { auth.access = null; try { localStorage.removeItem(SESSION_KEY); } catch (e) {} };

/* One refresh at a time: a refresh token works once, and a second use ends the sign-in. */
function refresh() {
  const token = savedRefresh();
  if (!token) return Promise.resolve(false);
  if (!auth.refreshing) {
    auth.refreshing = call('POST', '/auth/refresh', { body: { refreshToken: token } })
      .then(s => { keepSession(s); return true; }, e => { if (e.status === 401) forgetSession(); return false; })
      .finally(() => { auth.refreshing = null; });
  }
  return auth.refreshing;
}

async function call(method, path, opts = {}) {
  const headers = { accept: 'application/json', 'accept-language': lang, 'x-dua-platform': 'web' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.key) headers['idempotency-key'] = opts.key;
  if (opts.auth && auth.access) headers.authorization = 'Bearer ' + auth.access;
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch (e) { throw Object.assign(new Error('NETWORK'), { code: 'NETWORK', status: 0 }); }
  if (res.status === 401 && opts.auth && !opts.retried && await refresh()) return call(method, path, { ...opts, retried: true });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = (data && data.error) || {};
    throw Object.assign(new Error(err.code || 'UNKNOWN'), { code: err.code || 'UNKNOWN', status: res.status });
  }
  return data;
}

/* ---------- state ---------- */
const S = {
  view: 'pick',              // pick · details · code · choice · done · manage · mine
  from: null, to: null, sessions: null, price: undefined, cancelHours: 1,
  day: null, month: null, picked: null,
  form: { firstName: '', lastName: '', phone: '', email: '' }, code: '', key: null, resendAt: 0,
  me: null, detail: null, done: null, manage: null, manageToken: null, mine: null,
  catalogue: null, buy: null, bought: null, signin: null,
  busy: false, error: null, info: null, armed: null, timer: null
};
const app = document.getElementById('app');
const bar = document.getElementById('bar');
const add = node => { if (node) app.appendChild(node); };
const picked = () => (S.sessions || []).find(s => s.id === S.picked) || null;

function go(view) { S.view = view; S.error = null; S.info = null; S.armed = null; draw(); window.scrollTo(0, 0); }
function fail(e) { S.error = e.code || e.message || 'UNKNOWN'; S.busy = false; draw(); }

/* ---------- the page ---------- */
function draw() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-lang]').forEach(b => { b.classList.toggle('is-on', b.dataset.lang === lang); b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  drawMe();
  app.textContent = '';
  bar.hidden = true;
  bar.querySelector('.bar__in').textContent = '';
  ({ pick: drawPick, details: drawDetails, code: drawCode, choice: drawChoice, done: drawDone, manage: drawManage, mine: drawMine,
     shop: drawShop, signin: drawSignin, buy: drawBuy, bought: drawBought })[S.view]();
}

function drawMe() {
  const el = document.getElementById('me');
  el.textContent = '';
  el.hidden = !S.me;
  if (!S.me) return;
  const name = (S.me.profile && S.me.profile.firstName) || S.me.email;
  el.append(
    h('span', null, [t('Signed in as') + ' ', h('b', { text: name })]),
    h('span', null, [
      S.view !== 'mine' ? h('button.link', { type: 'button', text: t('My bookings'), onclick: openMine }) : null,
      ' · ',
      h('button.link', { type: 'button', text: t('Not you? Sign out'), onclick: signOut })
    ])
  );
}

function steps(n, of, title, lede) {
  add(h('div.steps', { 'aria-hidden': 'true' }, Array.from({ length: of }, (_, i) => h('span', { class: i < n ? 'is-on' : null }))));
  add(h('p.eyebrow.stepname', { text: t('Step %s of %s', n, of) }));
  add(h('h1.title', null, title));
  if (lede) add(h('p.lede', { text: lede }));
}
const flowLength = () => (S.me ? 2 : 4);
function barWith(kids) {
  bar.hidden = false;
  const inner = bar.querySelector('.bar__in');
  kids.filter(Boolean).forEach(k => inner.appendChild(k));
}
const errorBox = () => (S.error ? h('p.notice', { role: 'alert', text: t(S.error) }) : null);
const infoBox = () => (S.info ? h('p.notice.notice--soft', { role: 'status', text: S.info }) : null);
const priceNote = () => (S.price ? h('div.price', null, [h('span', { text: t('Single class') + ' · ' + t('paid at the studio, in cash') }), h('b', { text: money(S.price) })]) : null);
const policy = () => h('div.policy', null, [h('b', { text: t('Cancellation Policy') }), h('span', { text: t('Free cancellation until %s hour before the class. Cancelling later, or not coming, the class is still due.', S.cancelHours) })]);

/* ---------- 1. a day and a time ---------- */
/* Classes or packages: the two things the page sells. */
function tabs(on) {
  add(h('div.tabs', { role: 'tablist' }, [
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(on === 'pick'), class: on === 'pick' ? 'is-on' : null, text: t('Book a class'), onclick: () => go('pick') }),
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(on === 'shop'), class: on === 'shop' ? 'is-on' : null, text: t('Packages & offers'), onclick: openShop })
  ]));
}

function drawPick() {
  tabs('pick');
  steps(1, flowLength(), t('Book a class') + '.', t('Pick a day, then a time.'));
  add(priceNote());
  add(errorBox());
  if (!S.sessions) { add(h('p.loading', { style: 'min-height:30vh' }, '…')); return; }
  const now = Date.now();
  const open = S.sessions.filter(s => s.status === 'SCHEDULED' && new Date(s.endsAt) > now);
  if (!open.length || S.price === null) {
    add(h('div.emptybox', null, [h('p', { text: S.price === null ? t('SINGLE_PRICE_MISSING') : t('No classes are open for booking yet. Message us and we will save you a place.') }),
      h('a.btn.btn--wine', { href: 'https://wa.me/' + STUDIO_WA, target: '_blank', rel: 'noopener', text: t('Message the studio') })]));
    return;
  }
  const byDate = d => open.filter(s => tirana(s.startsAt).date === d);
  const dates = [];
  for (let d = S.from; d <= S.to; d = plusDays(d, 1)) dates.push(d);
  if (!S.day || !byDate(S.day).length) S.day = dates.find(d => byDate(d).some(s => s.available > 0)) || dates.find(d => byDate(d).length) || dates[0];
  add(calendar(dates, byDate));
  add(h('h2.display', { style: 'font-size:1.25rem;margin-top:14px', text: longDate(S.day) }));
  const slots = h('div.slots');
  const list = byDate(S.day);
  if (!list.length) slots.appendChild(h('p.empty', { text: t('Nothing on this day.') }));
  list.forEach(s => {
    const on = S.picked === s.id;
    const running = new Date(s.startsAt) <= now;
    const label = running ? t('In progress') : s.available <= 0 ? t('Full') : s.available === 1 ? t('1 place') : t('%s places', s.available);
    const z = tirana(s.startsAt), e = tirana(s.endsAt);
    slots.appendChild(h('button.slot', {
      type: 'button', class: (on ? 'is-on' : '') + (s.available > 0 && s.available <= 2 ? ' is-few' : ''),
      disabled: running || (s.available <= 0 && !on), 'aria-pressed': String(on),
      onclick: () => { S.picked = on ? null : s.id; S.error = null; draw(); }
    }, [
      h('span.slot__time', { text: z.time + '–' + e.time }),
      h('span.slot__what', null, [h('b', { text: className(s) }), s.instructor ? h('span', { text: t('with %s', s.instructor.name) }) : null]),
      h('span.slot__left', { text: label }),
      h('span.slot__box', { 'aria-hidden': 'true' }, on ? icon(ICON_CHECK) : null)
    ]));
  });
  add(slots);
  barWith([
    h('a.btn.btn--ghost', { href: '/', text: '←', 'aria-label': t('Back to the website') }),
    h('button.btn.btn--wine', { type: 'button', disabled: !S.picked || S.busy, text: S.busy ? t('One moment…') : t('Continue'), onclick: () => (S.me ? openChoice() : go('details')) })
  ]);
}
const className = s => (lang === 'en' && s.classType.nameEn) || s.classType.name;

/* A month on a page, Monday first: days with a free place carry a dot. */
function calendar(dates, byDate) {
  const first = dates[0].slice(0, 7), last = dates[dates.length - 1].slice(0, 7);
  if (!S.month || S.month < first || S.month > last) S.month = S.day.slice(0, 7);
  const y = +S.month.slice(0, 4), m = +S.month.slice(5, 7) - 1;
  const today = tirana(new Date()).date;
  const shift = n => {
    const x = new Date(y, m + n, 15);
    S.month = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
    const firstOpen = dates.find(d => d.startsWith(S.month) && byDate(d).some(s => s.available > 0));
    if (firstOpen) S.day = firstOpen;
    draw();
  };
  const arrow = (n, label, path) => {
    const b = h('button.cal__nav', { type: 'button', 'aria-label': label, disabled: n < 0 ? S.month <= first : S.month >= last, onclick: () => shift(n) });
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
    return b;
  };
  const grid = h('div.cal__grid', { role: 'grid' });
  [1, 2, 3, 4, 5, 6, 0].forEach(i => grid.appendChild(h('span.cal__wd', { text: DAYS3[lang][i] })));
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid.appendChild(h('span.cal__pad', { 'aria-hidden': 'true' }));
  const count = new Date(y, m + 1, 0).getDate();
  for (let n = 1; n <= count; n++) {
    const d = S.month + '-' + String(n).padStart(2, '0');
    const list = dates.includes(d) ? byDate(d) : [];
    const free = list.some(s => s.available > 0);
    const cls = [d === S.day ? 'is-on' : '', free ? 'has-room' : '', list.length && !free ? 'is-full' : '', list.some(s => s.id === S.picked) ? 'is-picked' : '', d === today ? 'is-today' : ''].filter(Boolean).join(' ');
    grid.appendChild(h('button.cal__day', { type: 'button', class: cls || null, disabled: !list.length, 'aria-label': longDate(d), 'aria-pressed': String(d === S.day),
      onclick: () => { S.day = d; draw(); } }, [h('span', { text: String(n) }), h('i', { 'aria-hidden': 'true' })]));
  }
  return h('div.cal', null, [
    h('div.cal__head', null, [arrow(-1, t('Previous month'), 'm15 6-6 6 6 6'), h('b', { text: MONTHS[lang][m] + ' ' + y }), arrow(1, t('Next month'), 'm9 6 6 6-6 6')]),
    grid,
    h('div.cal__key', null, [h('span', null, [h('i.k-room'), t('Free places')]), h('span', null, [h('i.k-full'), t('Full')])])
  ]);
}

/* What she is booking, the same block on every step. */
function classSummary(s, extra) {
  const rows = [];
  const row = (k, v, cls) => rows.push(h('div', { class: cls || null }, [h('span', { text: k }), h('span', { text: v })]));
  const z = tirana(s.startsAt), e = tirana(s.endsAt);
  row(t('Class'), className(s));
  row(t('Date'), longDate(z.date));
  row(t('Time'), z.time + '–' + e.time);
  if (s.instructor) row(t('Instructor'), s.instructor.name || s.instructor);
  (extra || []).forEach(([k, v, cls]) => row(k, v, cls));
  return h('div.summary', null, rows);
}

/* ---------- 2. who she is ---------- */
function drawDetails() {
  const s = picked();
  if (!s) return go('pick');
  steps(2, 4, t('Your details') + '.', t('We send you a code to confirm, then your booking.'));
  const field = (key, label, attrs) => h('label.field', null, [h('span', { text: label }),
    h('input', { name: key, value: S.form[key], ...attrs, oninput: e => { S.form[key] = e.target.value; e.target.closest('.field').classList.remove('is-bad'); } })]);
  const form = h('form.form', { novalidate: true, onsubmit: e => { e.preventDefault(); sendCode(); } }, [
    h('div.who', null, [
      h('div.row2', null, [
        field('firstName', t('First name'), { autocomplete: 'given-name', autocapitalize: 'words', required: true, maxlength: 60 }),
        field('lastName', t('Last name'), { autocomplete: 'family-name', autocapitalize: 'words', required: true, maxlength: 60 })
      ]),
      field('phone', t('Phone number'), { type: 'tel', inputmode: 'tel', autocomplete: 'tel', required: true, placeholder: '069 123 4567', maxlength: 30 }),
      field('email', t('Email'), { type: 'email', inputmode: 'email', autocomplete: 'email', autocapitalize: 'off', spellcheck: 'false', required: true, maxlength: 200 })
    ]),
    h('button', { type: 'submit', hidden: true })
  ]);
  add(form);
  add(classSummary(s, [[t('To pay'), money(S.price) + ' · ' + t('At the studio, in cash'), 'total']]));
  add(policy());
  add(errorBox());
  barWith([
    h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => go('pick') }),
    h('button.btn.btn--wine', { type: 'button', disabled: S.busy, text: S.busy ? t('One moment…') : t('Send me the code'), onclick: sendCode })
  ]);
}

function invalid(key, msg) {
  S.error = msg; draw();
  const el = document.querySelector('[name="' + key + '"]');
  if (el) { el.closest('.field').classList.add('is-bad'); el.focus(); }
}

async function sendCode() {
  const f = S.form;
  f.firstName = f.firstName.trim(); f.lastName = f.lastName.trim(); f.email = f.email.trim(); f.phone = f.phone.trim();
  if (!f.firstName) return invalid('firstName', 'Write your first name');
  if (!f.lastName) return invalid('lastName', 'Write your last name');
  if (f.phone.replace(/\D+/g, '').length < 8) return invalid('phone', 'Write a phone number we can call');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return invalid('email', 'That email does not look right');
  S.busy = true; S.error = null; draw();
  try {
    await call('POST', '/public/guest-bookings/code', { body: { sessionId: S.picked, email: f.email, lang } });
    S.busy = false; S.code = ''; S.key = newKey(); S.resendAt = Date.now() + 30_000;
    go('code');
  } catch (e) {
    if (['CLASS_FULL', 'CLASS_STARTED', 'CLASS_CANCELLED'].includes(e.code)) { await loadSessions(); S.picked = null; S.view = 'pick'; }
    fail(e);
  }
}

/* ---------- 3. the code ---------- */
function drawCode() {
  const s = picked();
  if (!s) return go('pick');
  steps(3, 4, t('Check your email') + '.', t('We sent a 6-digit code to %s. It expires in 10 minutes.', S.form.email));
  const input = h('input', { name: 'code', value: S.code, inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]*', maxlength: 6, 'aria-label': t('Code'),
    oninput: e => { S.code = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = S.code; if (S.code.length === 6) confirmCode(); } });
  add(h('form.form', { novalidate: true, onsubmit: e => { e.preventDefault(); confirmCode(); } }, [h('label.field.code', null, [h('span', { text: t('Code') }), input])]));
  // Only the countdown ticks; the field she is typing in is left alone.
  const resend = h('span');
  const tick = () => {
    const wait = Math.ceil((S.resendAt - Date.now()) / 1000);
    resend.textContent = '';
    resend.appendChild(wait > 0 ? h('span.muted.small', { text: t('New code in %s s', wait) }) : h('button.link', { type: 'button', text: t('Send a new code'), onclick: sendCode }));
    if (wait > 0) S.timer = setTimeout(() => { if (resend.isConnected) tick(); }, 1000);
  };
  clearTimeout(S.timer);
  tick();
  add(h('p.resend', null, [resend, ' · ', h('button.link', { type: 'button', text: t('Wrong email? Go back'), onclick: () => go('details') })]));
  add(errorBox());
  add(classSummary(s, [[t('To pay'), money(S.price) + ' · ' + t('At the studio, in cash'), 'total']]));
  barWith([
    h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => go('details') }),
    h('button.btn.btn--wine', { type: 'button', disabled: S.busy || S.code.length !== 6, text: S.busy ? t('One moment…') : t('Confirm booking'), onclick: confirmCode })
  ]);
  setTimeout(() => { const el = document.querySelector('[name="code"]'); if (el && document.activeElement !== el) el.focus(); }, 0);
}

async function confirmCode() {
  if (S.busy) return;
  if (!/^\d{6}$/.test(S.code)) return invalid('code', 'The code has 6 digits');
  S.busy = true; S.error = null; draw();
  try {
    const r = await call('POST', '/public/guest-bookings', { key: S.key, body: { sessionId: S.picked, ...S.form, code: S.code, lang, platform: 'WEB' } });
    S.busy = false;
    if (r.session) { keepSession(r.session); await loadMe(); }
    if (r.status === 'booked' || r.status === 'already_booked') {
      S.done = { booking: r.booking, emailed: r.status === 'booked' };
      loadSessions();
      return go('done');
    }
    if (r.status === 'has_package') return openChoice();
    // Verified, but the class could not be booked (filled meanwhile…): back to the timetable, signed in.
    await loadSessions();
    S.picked = null; S.view = 'pick';
    return fail({ code: r.error && r.error.code });
  } catch (e) {
    S.code = '';
    fail(e);
  }
}

/* ---------- signed in: package or single ---------- */
async function openChoice() {
  S.busy = true; S.error = null; draw();
  try {
    S.detail = await call('GET', '/sessions/' + S.picked, { auth: true });
    S.busy = false; S.key = newKey();
    go('choice');
  } catch (e) {
    if (e.status === 401) { forgetSession(); S.me = null; S.busy = false; return go('details'); }
    fail(e);
  }
}

function drawChoice() {
  const s = picked(), d = S.detail;
  if (!s || !d) return go('pick');
  const credits = d.myCredits || 0;
  steps(flowLength() === 2 ? 2 : 4, flowLength(), d.eligible || d.duo ? t('How do you want to book it?') : t('Confirm: %s', className(s)) + '.',
    d.eligible ? (credits === 1 ? t('You have 1 session in your package') : t('You have %s sessions in your package', credits)) + '.' : null);
  add(classSummary(s));
  add(errorBox());
  const book = (single) => async () => {
    if (S.busy) return;
    S.busy = true; S.error = null; draw();
    try {
      const b = await call('POST', '/sessions/' + S.picked + (single ? '/book-single' : '/book'), { auth: true, key: S.key });
      S.busy = false;
      S.done = { booking: null, session: s, order: b.order || null };
      loadSessions();
      go('done');
    } catch (e) {
      if (['CLASS_FULL', 'CLASS_STARTED', 'ALREADY_BOOKED'].includes(e.code)) { await loadSessions(); S.picked = null; S.view = 'pick'; }
      fail(e);
    }
  };
  const bookDuo = async () => {
    if (S.busy) return;
    S.busy = true; S.error = null; draw();
    try {
      await call('POST', '/sessions/' + S.picked + '/book-duo', { auth: true, key: S.key });
      S.busy = false;
      S.done = { booking: null, session: s, order: null, duo: d.duo.partner };
      loadSessions();
      go('done');
    } catch (e) {
      if (['CLASS_FULL', 'CLASS_STARTED', 'ALREADY_BOOKED'].includes(e.code)) { await loadSessions(); S.picked = null; S.view = 'pick'; }
      fail(e);
    }
  };
  const options = h('div.choice', null, [
    d.duo ? h('button', { type: 'button', disabled: S.busy, onclick: bookDuo }, [h('b', { text: t('Book for both of us (DUO)') }), h('span', { text: t('With %s · two places, a session from each package', d.duo.partner) })]) : null,
    d.eligible ? h('button', { type: 'button', disabled: S.busy, onclick: book(false) }, [h('b', { text: t('Use 1 session from my package') }), h('span', { text: t('%s left after this', credits - 1) })]) : null,
    d.singlePrice ? h('button', { type: 'button', disabled: S.busy, onclick: book(true) }, [h('b', { text: t('Book it as a single class') }), h('span', { text: t('%s, paid at the studio', money(d.singlePrice)) })]) : null
  ]);
  add(options);
  add(policy());
  barWith([h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => go('pick') })]);
}

/* ---------- 4. booked ---------- */
function drawDone() {
  const d = S.done;
  if (!d) return go('pick');
  const b = d.booking;
  const s = b ? { startsAt: b.class.startsAt, endsAt: b.class.endsAt, classType: { name: b.class.name, nameEn: b.class.nameEn }, instructor: b.class.instructor ? { name: b.class.instructor } : null } : d.session;
  const owes = b ? b.payment : d.order;
  const name = (b && b.firstName) || (S.me && S.me.profile && S.me.profile.firstName) || '';
  steps(flowLength(), flowLength(), t('Booked') + '.');
  add(h('div.done', null, [
    h('p.lede', { style: 'margin:0 auto', text: d.duo ? t('See you both there, %s and %s!', name, d.duo) : t('See you there, %s!', name) }),
    h('p.lede', { style: 'margin:8px auto 0', text: owes ? t('Your place is confirmed. You pay at the studio, in cash.') : t('Your place is confirmed.') })
  ]));
  add(classSummary(s, [
    owes ? [t('To pay'), money(owes.total) + ' · ' + t('At the studio, in cash'), 'total'] : [t('Payment'), t('From your package')],
    owes && owes.reference ? [t('Reference'), owes.reference] : null
  ].filter(Boolean)));
  if (b) add(h('p.notice.notice--soft', { text: t('Free cancellation until %s.', whenShort(b.freeCancelUntil)) + (d.emailed ? ' ' + t('We emailed you a private link to see or cancel it.') : '') }));
  add(policy());
  barWith([
    S.me ? h('button.btn.btn--ghost', { type: 'button', text: t('My bookings'), onclick: openMine }) : h('a.btn.btn--ghost', { href: '/', text: '←', 'aria-label': t('Back to the website') }),
    h('button.btn.btn--wine', { type: 'button', text: t('Book another class'), onclick: () => { S.picked = null; S.done = null; go('pick'); } })
  ]);
}

/* ---------- one booking, from the private link ---------- */
async function openManage(token) {
  S.manageToken = token; S.view = 'manage'; draw();
  try { S.manage = await call('POST', '/public/bookings/manage', { body: { token } }); }
  catch (e) { S.manage = { gone: true }; }
  draw();
}

const bookingStatus = b => b.status === 'BOOKED' ? t('Reserved') : b.status === 'LATE_CANCELLED' ? t('Cancelled late') : b.status === 'SESSION_CANCELLED' ? t('Cancelled by the studio') : t('Cancelled');
const paymentText = p => (p.status === 'PAID' ? t('Paid') : p.status === 'CANCELLED' ? t('Not owed') : t('Not paid yet')) + ' · ' + money(p.total);

function drawManage() {
  const v = S.manage;
  add(h('h1.title', { style: 'margin-top:8px' }, t('Your booking') + '.'));
  if (!v) { add(h('p.loading', { style: 'min-height:30vh' }, '…')); return; }
  if (v.gone) {
    add(h('div.emptybox', null, [h('p', { text: t('This link does not open a booking any more. Ask the studio, or book again.') })]));
    barWith([h('a.btn.btn--ghost', { href: 'https://wa.me/' + STUDIO_WA, target: '_blank', rel: 'noopener', text: t('Message the studio') }),
      h('button.btn.btn--wine', { type: 'button', text: t('Book another class'), onclick: leaveManage })]);
    return;
  }
  const s = { startsAt: v.class.startsAt, endsAt: v.class.endsAt, classType: { name: v.class.name, nameEn: v.class.nameEn }, instructor: v.class.instructor ? { name: v.class.instructor } : null };
  add(classSummary(s, [
    [t('Status'), bookingStatus(v)],
    v.payment ? [t('Payment'), paymentText(v.payment)] : null,
    v.payment ? [t('Reference'), v.payment.reference] : null
  ].filter(Boolean)));
  add(infoBox());
  add(errorBox());
  if (v.canCancel) {
    const free = new Date() < new Date(v.freeCancelUntil).getTime() + 1000;
    add(h('p.notice.notice--soft', { text: free ? t('Cancelling now is free.') + ' ' + t('Free cancellation until %s.', whenShort(v.freeCancelUntil)) : t('It is past the free cancellation time: if you cancel, the class is still due.') }));
  }
  add(policy());
  barWith([
    h('button.btn.btn--ghost', { type: 'button', text: t('Book another class'), onclick: leaveManage }),
    v.canCancel ? h('button.btn.btn--wine', { type: 'button', disabled: S.busy, text: S.armed === 'manage' ? t('Tap again to cancel') : t('Cancel booking'), onclick: cancelFromLink }) : null
  ]);
}

async function cancelFromLink() {
  if (S.armed !== 'manage') { S.armed = 'manage'; draw(); return; }
  S.busy = true; S.armed = null; draw();
  try {
    const r = await call('POST', '/public/bookings/manage/cancel', { body: { token: S.manageToken } });
    S.manage = r.booking; S.busy = false;
    S.info = r.status === 'LATE_CANCELLED' ? t('Cancelled late: the class is still due.') : t('Cancelled. You owe nothing.');
    S.manage.canCancel = false;
    loadSessions();
    draw();
  } catch (e) { fail(e); }
}
function leaveManage() { S.manage = null; S.manageToken = null; S.picked = null; go('pick'); }

/* ---------- signed in: my bookings ---------- */
async function openMine() {
  S.view = 'mine'; S.mine = null; S.error = null; draw();
  try { S.mine = await call('GET', '/me/bookings?scope=upcoming', { auth: true }); }
  catch (e) { if (e.status === 401) { forgetSession(); S.me = null; return go('pick'); } return fail(e); }
  draw();
}

function drawMine() {
  add(h('h1.title', { style: 'margin-top:8px' }, t('My bookings') + '.'));
  add(infoBox());
  add(errorBox());
  if (!S.mine) { add(h('p.loading', { style: 'min-height:30vh' }, '…')); return; }
  if (!S.mine.length) add(h('p.empty', { text: t('No upcoming classes.') }));
  const list = h('ul.mine');
  S.mine.forEach(b => {
    const s = b.session, z = tirana(s.startsAt), e = tirana(s.endsAt);
    const free = Date.now() < new Date(b.freeCancelUntil).getTime() + 1000;
    list.appendChild(h('li', null, [
      h('span.when', { text: longDate(z.date) + ' · ' + z.time + '–' + e.time }),
      h('span.muted.small', { text: className(s) + (s.instructor ? ' · ' + t('with %s', s.instructor.name) : '') + ' · ' + (b.creditsUsed ? t('From your package') : t('At the studio, in cash')) }),
      b.canCancel ? h('div.actions', null, [
        h('span.small.muted', { text: free ? t('Free cancellation until %s.', whenShort(b.freeCancelUntil)) : t('It is past the free cancellation time: if you cancel, the class is still due.') }),
        h('button.btn.btn--sm.btn--ghost', { type: 'button', disabled: S.busy, text: S.armed === b.id ? t('Tap again to cancel') : t('Cancel booking'), onclick: () => cancelMine(b) })
      ]) : null
    ]));
  });
  add(list);
  add(policy());
  barWith([h('button.btn.btn--wine', { type: 'button', text: t('Book another class'), onclick: () => { S.picked = null; go('pick'); } })]);
}

async function cancelMine(b) {
  if (S.armed !== b.id) { S.armed = b.id; draw(); return; }
  S.busy = true; S.armed = null; draw();
  try {
    const r = await call('POST', '/bookings/' + b.id + '/cancel', { auth: true });
    S.busy = false;
    S.info = r.status === 'LATE_CANCELLED' ? t('Cancelled late: the class is still due.') : r.refunded ? t('Cancelled. The session is back in your package.') : t('Cancelled. You owe nothing.');
    loadSessions();
    await openMine();
  } catch (e) { fail(e); }
}

async function signOut() {
  const token = savedRefresh();
  forgetSession();
  S.me = null;
  if (token) call('POST', '/auth/logout', { body: { refreshToken: token } }).catch(() => {});
  S.picked = null;
  go('pick');
}

/* ---------- packages and offers ----------
   The same catalogue the app sells from. Reserving a package needs her
   email proven once (a code); she pays at the studio, and the sessions
   start the moment it is paid — never before. */
const pname = p => (lang === 'en' && p.nameEn) || p.name;
const otitle = o => (lang === 'en' && o.titleEn) || o.title;
const otext = (o, f) => (lang === 'en' && o[f + 'En']) || o[f] || '';
const pct = (price, p) => Math.round(price * (100 - p) / 100);

async function openShop() {
  go('shop');
  if (S.catalogue) return;
  try { S.catalogue = await call('GET', '/public/catalogue'); } catch (e) { S.catalogue = { products: [], offers: [] }; S.error = e.code; }
  draw();
}

function drawShop() {
  tabs('shop');
  add(h('h1.title', { style: 'margin-top:8px' }, t('Packages & offers') + '.'));
  add(h('p.lede', { text: t('Reserve now, pay at the studio in cash. Your sessions start as soon as it is paid.') }));
  add(errorBox());
  const c = S.catalogue;
  if (!c) { add(h('p.loading', { style: 'min-height:30vh' }, '…')); return; }
  const card = (title, sub, price, was, onclick, tag) => h('button.offer', { type: 'button', onclick }, [
    tag ? h('span.offer__tag', { text: tag }) : null,
    h('b.offer__title', { text: title }),
    sub ? h('span.offer__sub', { text: sub }) : null,
    h('span.offer__price', null, [was ? h('s', { text: money(was) }) : null, was ? ' ' : null, money(price)])
  ]);
  const what = p => (p.classCredits === 1 ? t('1 class') : t('%s classes', p.classCredits)) + ' · ' + t('valid %s days', p.validityDays);
  if (c.offers.length) {
    add(h('p.eyebrow', { style: 'margin-top:26px', text: t('Offers') }));
    const list = h('div.offers');
    c.offers.forEach(o => {
      if (o.kind === 'BUNDLE' && o.product) {
        list.appendChild(card(otitle(o), otext(o, 'description') || what(o.product) + (o.product.persons === 2 ? ' · ' + t('for two') : ''), o.product.price, o.product.originalPrice, () => choose(o.product, o), o.left != null ? t('%s left', o.left) : null));
        return;
      }
      // A discount or a bonus applies to packages: one card per package it applies to.
      const eligible = c.products.filter(p => p.kind !== 'SINGLE' && (!o.eligibleProductIds.length || o.eligibleProductIds.includes(p.id)));
      eligible.forEach(p => {
        const sub = o.kind === 'DISCOUNT' ? t('%s off', o.discountPct + '%') + ' · ' + what(p) : t('+%s bonus class with a friend', o.bonusClasses) + ' · ' + what(p);
        list.appendChild(card(otitle(o) + ' · ' + pname(p), sub, o.kind === 'DISCOUNT' ? pct(p.price, o.discountPct) : p.price, o.kind === 'DISCOUNT' ? p.price : null, () => choose(p, o), o.newClientsOnly ? t('New clients') : null));
      });
    });
    add(list);
  }
  const plain = c.products.filter(p => p.kind !== 'SINGLE' && p.persons === 1);
  if (plain.length) {
    add(h('p.eyebrow', { style: 'margin-top:26px', text: t('Packages') }));
    add(h('div.offers', null, plain.map(p => card(pname(p), otext(p, 'description') || what(p), p.price, p.originalPrice, () => choose(p, null)))));
  }
  barWith([h('a.btn.btn--ghost', { href: '/', text: '←', 'aria-label': t('Back to the website') })]);
}

function choose(product, offer) {
  S.buy = { product, offer, partner: { firstName: '', lastName: '', phone: '', email: '' }, friend: { firstName: '', lastName: '', phone: '', email: '' } };
  S.key = newKey();
  if (S.me) return go('buy');
  S.signin = { step: 'email', email: S.form.email || '', code: '', firstName: S.form.firstName || '', lastName: S.form.lastName || '', phone: S.form.phone || '', token: null };
  go('signin');
}

/* Proving her email: the same code as signing in to the app. New here: a name and a phone, once. */
function drawSignin() {
  const g = S.signin;
  add(h('h1.title', { style: 'margin-top:8px' }, (g.step === 'email' ? t('Your email') : g.step === 'code' ? t('Check your email') : t('Your details')) + '.'));
  add(h('p.lede', { text: g.step === 'email' ? t('We send you a code — no password needed.') : g.step === 'code' ? t('We sent a 6-digit code to %s. It expires in 10 minutes.', g.email) : t('First time at DUA: tell us who you are.') }));
  const field = (key, label, attrs) => h('label.field', null, [h('span', { text: label }), h('input', { name: key, value: g[key], ...attrs, oninput: e => { g[key] = e.target.value; } })]);
  const fields = g.step === 'email'
    ? [field('email', t('Email'), { type: 'email', inputmode: 'email', autocomplete: 'email', autocapitalize: 'off', spellcheck: 'false' })]
    : g.step === 'code'
      ? [h('label.field.code', null, [h('span', { text: t('Code') }), h('input', { name: 'code', value: g.code, inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, oninput: e => { g.code = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = g.code; if (g.code.length === 6) next(); } })])]
      : [h('div.row2', null, [field('firstName', t('First name'), { autocomplete: 'given-name' }), field('lastName', t('Last name'), { autocomplete: 'family-name' })]),
         field('phone', t('Phone number'), { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '069 123 4567' })];
  add(h('form.form', { novalidate: true, onsubmit: e => { e.preventDefault(); next(); } }, [h('div.who', null, fields), h('button', { type: 'submit', hidden: true })]));
  add(errorBox());
  barWith([
    h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => (g.step === 'email' ? go('shop') : (g.step = 'email', go('signin'))) }),
    h('button.btn.btn--wine', { type: 'button', disabled: S.busy, text: S.busy ? t('One moment…') : t('Continue'), onclick: next })
  ]);

  async function next() {
    if (S.busy) return;
    S.error = null;
    if (g.step === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email.trim())) return invalid('email', 'That email does not look right');
    if (g.step === 'code' && !/^\d{6}$/.test(g.code)) return invalid('code', 'The code has 6 digits');
    if (g.step === 'profile') {
      if (!g.firstName.trim()) return invalid('firstName', 'Write your first name');
      if (!g.lastName.trim()) return invalid('lastName', 'Write your last name');
      if (g.phone.replace(/\D+/g, '').length < 8) return invalid('phone', 'Write a phone number we can call');
    }
    S.busy = true; draw();
    try {
      if (g.step === 'email') {
        g.email = g.email.trim();
        await call('POST', '/auth/otp/request', { body: { email: g.email, lang } });
        g.step = 'code';
      } else if (g.step === 'code') {
        const r = await call('POST', '/auth/otp/verify', { body: { email: g.email, code: g.code } });
        if (r.status === 'signed_in') { keepSession(r); await loadMe(); S.busy = false; return go('buy'); }
        g.token = r.registrationToken; g.step = 'profile';
      } else {
        const r = await call('POST', '/auth/register', { body: { registrationToken: g.token, firstName: g.firstName.trim(), lastName: g.lastName.trim(), phone: g.phone.trim(), language: lang } });
        keepSession(r); await loadMe(); S.busy = false; return go('buy');
      }
      S.busy = false; draw();
    } catch (e) { if (g.step === 'code') g.code = ''; fail(e); }
  }
}

function drawBuy() {
  const b = S.buy;
  if (!b || !S.me) return go('shop');
  const p = b.product, o = b.offer;
  const price = o && o.kind === 'DISCOUNT' ? pct(p.price, o.discountPct) : p.price;
  add(h('h1.title', { style: 'margin-top:8px' }, (o ? otitle(o) + (o.kind === 'BUNDLE' ? '' : ' · ' + pname(p)) : pname(p)) + '.'));
  const rows = [
    [t('Classes'), String(p.classCredits) + (p.persons === 2 ? ' × 2' : '')],
    [t('Valid'), t('%s days from payment', p.validityDays)],
    o && o.kind === 'DISCOUNT' ? [t('Regular price'), money(p.price)] : null,
    o && o.kind === 'BONUS' ? [t('Bonus'), t('+%s class for you and your friend when she pays for her own package', o.bonusClasses)] : null,
    [t('To pay'), money(price) + ' · ' + t('At the studio, in cash'), 'total']
  ].filter(Boolean);
  add(h('div.summary', null, rows.map(([k, v, cls]) => h('div', { class: cls || null }, [h('span', { text: k }), h('span', { text: v })]))));
  const person = (obj, label, hint) => {
    const f = (key, lab, attrs) => h('label.field', null, [h('span', { text: lab }), h('input', { name: label + key, value: obj[key], ...attrs, oninput: e => { obj[key] = e.target.value; } })]);
    return h('div.who', null, [
      h('span.eyebrow', { text: label }),
      h('div.row2', null, [f('firstName', t('First name'), { autocapitalize: 'words' }), f('lastName', t('Last name'), { autocapitalize: 'words' })]),
      f('phone', t('Phone number'), { type: 'tel', inputmode: 'tel', placeholder: '069 123 4567' }),
      h('p.muted.small', { text: hint })
    ]);
  };
  const needsPartner = p.persons === 2;
  const needsFriend = o && o.kind === 'BONUS';
  if (needsPartner || needsFriend) {
    add(h('form.form', { novalidate: true, onsubmit: e => e.preventDefault() }, [
      needsPartner ? person(b.partner, t('Your DUO partner'), t('She gets her own package with the same classes; you book your classes together.')) : null,
      needsFriend ? person(b.friend, t('Your friend'), t('She must be new to DUA. Your bonus comes when she pays for a package of her own.')) : null
    ]));
  }
  add(h('div.policy', null, [h('b', { text: t('How it works') }), h('span', { text: t('Your package is reserved now. Pay at the studio, in cash; your sessions start as soon as it is paid.') })]));
  add(errorBox());
  barWith([
    h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => go('shop') }),
    h('button.btn.btn--wine', { type: 'button', disabled: S.busy, text: S.busy ? t('One moment…') : t('Reserve the package'), onclick: reserve })
  ]);

  async function reserve() {
    if (S.busy) return;
    const ok = (obj, label) => {
      if (!obj.firstName.trim() || !obj.lastName.trim()) { invalid(label + 'firstName', 'Write the full name of the other person'); return false; }
      if (obj.phone.replace(/\D+/g, '').length < 8) { invalid(label + 'phone', 'Write a phone number we can call'); return false; }
      return true;
    };
    if (needsPartner && !ok(b.partner, t('Your DUO partner'))) return;
    if (needsFriend && o.friendRequired && !ok(b.friend, t('Your friend'))) return;
    const clean = x => ({ firstName: x.firstName.trim(), lastName: x.lastName.trim(), phone: x.phone.trim() });
    S.busy = true; S.error = null; draw();
    try {
      const order = await call('POST', '/orders', { auth: true, key: S.key, body: {
        productId: o && o.kind === 'BUNDLE' ? undefined : p.id, offerId: o ? o.id : undefined,
        partner: needsPartner ? clean(b.partner) : undefined, friend: needsFriend && b.friend.firstName ? clean(b.friend) : undefined
      } });
      S.busy = false; S.bought = { order, title: o ? otitle(o) : pname(p), partner: needsPartner ? b.partner.firstName : null };
      S.catalogue = null;
      go('bought');
    } catch (e) { fail(e); }
  }
}

function drawBought() {
  const x = S.bought;
  if (!x) return go('shop');
  add(h('h1.title', { style: 'margin-top:8px' }, t('Reserved') + '.'));
  add(h('div.summary', null, [
    h('div', null, [h('span', { text: t('Package') }), h('span', { text: x.title })]),
    x.partner ? h('div', null, [h('span', { text: t('With') }), h('span', { text: x.partner })]) : null,
    h('div', null, [h('span', { text: t('Reference') }), h('span', { text: x.order.reference })]),
    h('div', { class: 'total' }, [h('span', { text: t('To pay') }), h('span', { text: money(x.order.total) + ' · ' + t('At the studio, in cash') })])
  ]));
  add(h('p.notice.notice--soft', { text: t('Show the reference at the studio. Your sessions start as soon as it is paid.') }));
  barWith([
    h('button.btn.btn--ghost', { type: 'button', text: t('Packages & offers'), onclick: openShop }),
    h('button.btn.btn--wine', { type: 'button', text: t('Book a class'), onclick: () => go('pick') })
  ]);
}

/* ---------- loading ---------- */
async function loadSessions() {
  S.from = tirana(new Date()).date;
  S.to = plusDays(S.from, 30);
  try {
    const r = await call('GET', '/public/sessions?from=' + S.from + '&to=' + S.to);
    S.sessions = r.sessions; S.price = r.singlePrice;
    if (S.picked && !S.sessions.some(s => s.id === S.picked)) S.picked = null;
  } catch (e) { S.sessions = S.sessions || []; S.error = e.code; }
  if (['pick', 'mine'].includes(S.view)) draw();
}

async function loadMe() {
  if (!auth.access && !(await refresh())) { S.me = null; return; }
  try {
    const me = await call('GET', '/me', { auth: true });
    S.me = me.role === 'CLIENT' ? me : null;
    if (!S.me) forgetSession();
  } catch (e) { S.me = null; }
}

document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  try { localStorage.setItem('dua-lang', lang); } catch (e) {}
  draw();
}));

(async function start() {
  // The private link: read it, then take it off the address bar so it is not shared by accident.
  const m = /[#&]manage=([\w-]{20,100})/.exec(location.hash);
  if (m) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    openManage(m[1]);
  } else draw();
  call('GET', '/public/studio').then(st => { S.cancelHours = st.policies.freeCancelHours; if (S.view !== 'code') draw(); }, () => {});
  await Promise.all([loadSessions(), loadMe()]);
  if (S.view !== 'code') draw();
})();
