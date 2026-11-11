/* ============================================================
   DUA — booking a class
   ------------------------------------------------------------
   For clients the studio has set up: the desk makes her account,
   gives her a package and a sign-in code (DUA-…). Here she signs
   in with her email and that code, picks a day and a time, and a
   session comes off her package. Nothing is sold or paid here.

   Everything is decided by the same server the app uses (the
   meta tag "dua-api" names it): places, her sessions, the
   cancellation rule. A booking made here is in the app and at
   the desk at once.
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
  'Book a class': 'Rezervo një klasë', 'Booked': 'U rezervua',
  'Pick a day, then a time.': 'Zgjidh një ditë, pastaj orën.',
  'Previous month': 'Muaji i kaluar', 'Next month': 'Muaji tjetër', 'Free places': 'Vende të lira', 'Full': 'Plot',
  '%s places': '%s vende', '1 place': '1 vend', 'with %s': 'me %s', 'In progress': 'Po zhvillohet',
  'Nothing on this day.': 'Asgjë këtë ditë.',
  'No classes are open for booking yet.': 'Ende nuk ka klasa të hapura për rezervim.',
  'Continue': 'Vazhdo', 'Back': 'Kthehu', 'One moment…': 'Një moment…',
  'Sign in': 'Hyr', 'Email': 'Email', 'Your code': 'Kodi yt',
  'Trial class': 'Klasë prove', 'Single class': 'Klasë e vetme',
  'I have an account': 'Kam llogari', 'Book as a visitor': 'Rezervo si vizitore',
  'No account needed: your name and phone. You pay for the class at the studio, in cash.': 'Pa llogari: vetëm emri dhe telefoni. Klasën e paguan në studio, me cash.',
  'First name': 'Emri', 'Last name': 'Mbiemri', 'Phone number': 'Numri i telefonit', 'Email (optional)': 'Email (opsionale)',
  'Book the class': 'Rezervo klasën', 'To pay': 'Për të paguar', 'At the studio, in cash': 'Në studio, me cash',
  'Your place is confirmed. You pay at the studio, in cash. To change or cancel it, message the studio.': 'Vendi yt është i konfirmuar. Paguan në studio, me cash. Për ta ndryshuar ose anuluar, shkruaji studios.',
  'Write your first name': 'Shkruaj emrin', 'Write your last name': 'Shkruaj mbiemrin', 'Write a phone number we can call': 'Shkruaj një numër telefoni ku të marrim',
  'VALIDATION': 'Kontrollo të dhënat: numri i telefonit duhet të jetë i plotë.', 'SINGLE_PRICE_MISSING': 'Rezervimi si vizitore nuk është i hapur tani. Na shkruaj në WhatsApp.',
  'Use the username (or email) and the DUA-… code the studio gave you.': 'Përdor përdoruesin (ose email-in) dhe kodin DUA-… që të dha studioja.',
  'Username or email': 'Përdoruesi ose email-i', 'Write your username or email': 'Shkruaj përdoruesin ose email-in',
  'No code yet, or lost it? Ask the studio.': 'S\'ke kod, ose e humbe? Pyet studion.',
  'Class': 'Klasa', 'Date': 'Data', 'Time': 'Ora', 'Instructor': 'Instruktorja', 'Payment': 'Pagesa', 'From your package': 'Nga paketa jote',
  'Cancellation Policy': 'Politika e anulimit',
  'Free cancellation until %s hour before the class. Cancelling later, or not coming, the session is used.':
    'Anulim falas deri %s orë para klasës. Nëse anulon më vonë, ose nuk vjen, seanca llogaritet e përdorur.',
  'See you there, %s!': 'Të presim, %s!', 'See you both there, %s and %s!': 'Ju presim të dyja, %s dhe %s!',
  'Your place is confirmed.': 'Vendi yt është i konfirmuar.',
  'Free cancellation until %s.': 'Anulim falas deri: %s.',
  'Book another class': 'Rezervo një klasë tjetër', 'My bookings': 'Rezervimet e mia', 'Back to the website': 'Kthehu te faqja',
  'You have %s sessions in your package': 'Ke %s seanca në paketë', 'You have 1 session in your package': 'Ke 1 seancë në paketë',
  'Book this class': 'Rezervo këtë klasë', 'Use 1 session from my package': 'Përdor 1 seancë nga paketa', 'Reserve': 'Rezervo', '1 session from your package · %s left after this': '1 seancë nga paketa · të mbeten %s pas kësaj', 'Book this class?': 'Rezervo këtë klasë?', 'One class will be used from your package.': 'Do të përdoret 1 klasë nga paketa jote.', 'Are you sure?': 'Je e sigurt?', 'Yes, book': 'Po, rezervo', 'Cancel': 'Anulo', '%s left after this': 'Të mbeten %s pas kësaj',
  'Book for both of us (DUO)': 'Rezervo për të dyja (DUO)', 'With %s · two places, a session from each package': 'Me %s · dy vende, një seancë nga secila paketë',
  'No sessions left in your package. Ask the studio for a new one.': 'Nuk ke seanca të mbetura në paketë. Pyet studion për një paketë të re.',
  'Signed in as': 'Je brenda si', 'Sign out': 'Dil',
  'Cancel booking': 'Anulo rezervimin', 'Tap again to cancel': 'Shtyp sërish për ta anuluar',
  'It is past the free cancellation time: if you cancel, the session is used.': 'Ka kaluar afati i anulimit falas: nëse anulon, seanca llogaritet e përdorur.',
  'Cancelled. The session is back in your package.': 'U anulua. Seanca u kthye në paketë.',
  'Cancelled late: the session is used.': 'U anulua me vonesë: seanca llogaritet e përdorur.', 'Cancelled.': 'U anulua.',
  'No upcoming classes.': 'Asnjë klasë në vijim.',
  'Message the studio': 'Shkruaji studios',
  /* What the server says, by code */
  'INVALID_CREDENTIALS': 'Email-i ose kodi nuk është i saktë.', 'UNAUTHORIZED': 'Email-i ose kodi nuk është i saktë.',
  'RATE_LIMITED': 'Shumë kërkesa. Provo sërish pas pak.', 'CLASS_FULL': 'Kjo klasë sapo u mbush. Zgjidh një orë tjetër.',
  'CLASS_STARTED': 'Kjo klasë ka filluar.', 'CLASS_CANCELLED': 'Kjo klasë nuk pranon më rezervime.', 'STUDIO_CLOSED': 'Studioja është e mbyllur atë ditë.',
  'ALREADY_BOOKED': 'E ke tashmë një vend në këtë klasë.', 'BOOKING_NOT_OPEN': 'Rezervimet për këtë datë nuk janë hapur ende.',
  'INSUFFICIENT_CREDITS': 'Nuk ke seanca të mbetura në paketë.', 'NO_MEMBERSHIP': 'Nuk ke paketë aktive. Pyet studion.', 'MEMBERSHIP_EXPIRED': 'Paketa jote ka skaduar. Pyet studion.',
  'CANCEL_CLOSED': 'Klasa ka filluar, nuk anulohet më.', 'DUO_TOGETHER': 'DUO-ja juaj rezervohet bashkë: zgjidh "Rezervo për të dyja".',
  'NETWORK': 'Nuk u lidhëm dot. Kontrollo internetin dhe provo sërish.', 'UNKNOWN': 'Diçka shkoi keq. Provo sërish.',
  'That email does not look right': 'Ky email nuk duket i saktë', 'Write your code': 'Shkruaj kodin'
};
const EN = {
  INVALID_CREDENTIALS: 'That email or code is not right.', UNAUTHORIZED: 'That email or code is not right.',
  RATE_LIMITED: 'Too many requests. Try again in a little while.', CLASS_FULL: 'That class has just filled up. Pick another time.',
  CLASS_STARTED: 'This class has already started.', CLASS_CANCELLED: 'This class is not taking bookings.', STUDIO_CLOSED: 'The studio is closed that day.',
  ALREADY_BOOKED: 'You already have a place in this class.', BOOKING_NOT_OPEN: 'Booking for this date is not open yet.',
  INSUFFICIENT_CREDITS: 'No sessions left in your package.', NO_MEMBERSHIP: 'You have no active package. Ask the studio.', MEMBERSHIP_EXPIRED: 'Your package has expired. Ask the studio.',
  CANCEL_CLOSED: 'The class has started, it can no longer be cancelled.', DUO_TOGETHER: 'Your DUO is booked together: choose "Book for both of us".',
  NETWORK: 'We could not connect. Check your internet and try again.', UNKNOWN: 'Something went wrong. Try again.'
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
  view: 'pick',              // pick · login · choice · done · mine
  from: null, to: null, sessions: null, cancelHours: 1,
  day: null, month: null, picked: null,
  login: { email: '', password: '' }, key: null,
  // Signing in is chosen by default; a visitor switches to the short form.
  asVisitor: false, visitor: { firstName: '', lastName: '', phone: '', email: '' },
  me: null, detail: null, done: null, mine: null,
  busy: false, error: null, info: null, armed: null
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
  ({ pick: drawPick, login: drawLogin, choice: drawChoice, done: drawDone, mine: drawMine })[S.view]();
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
      S.view !== 'mine' ? ' · ' : null,
      h('button.link', { type: 'button', text: t('Sign out'), onclick: signOut })
    ])
  );
}

function title(text, lede) {
  add(h('h1.title', { style: 'margin-top:8px' }, text));
  if (lede) add(h('p.lede', { text: lede }));
}
function barWith(kids) {
  bar.hidden = false;
  const inner = bar.querySelector('.bar__in');
  kids.filter(Boolean).forEach(k => inner.appendChild(k));
}
const errorBox = () => (S.error ? h('p.notice', { role: 'alert', text: t(S.error) }) : null);
const infoBox = () => (S.info ? h('p.notice.notice--soft', { role: 'status', text: S.info }) : null);
const policy = () => h('div.policy', null, [h('b', { text: t('Cancellation Policy') }), h('span', { text: t('Free cancellation until %s hour before the class. Cancelling later, or not coming, the session is used.', S.cancelHours) })]);
/* What a visitor pays at the studio, said in passing. */
const prices = () => h('p.muted.small', { text: '(' + t('Trial class') + ' 1,400 L · ' + t('Single class') + ' 2,400 L)' });
const studioLink = () => h('a.btn.btn--ghost', { href: 'https://wa.me/' + STUDIO_WA, target: '_blank', rel: 'noopener', text: t('Message the studio') });

/* ---------- 1. a day and a time ---------- */
function drawPick() {
  title(t('Book a class') + '.', t('Pick a day, then a time.'));
  add(errorBox());
  if (!S.sessions) { add(h('p.loading', { style: 'min-height:30vh' }, '…')); return; }
  const now = Date.now();
  const open = S.sessions.filter(s => s.status === 'SCHEDULED' && new Date(s.endsAt) > now);
  if (!open.length) {
    add(h('div.emptybox', null, [h('p', { text: t('No classes are open for booking yet.') }), studioLink()]));
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
    h('button.btn.btn--wine', { type: 'button', disabled: !S.picked || S.busy, text: S.busy ? t('One moment…') : t('Continue'), onclick: () => (S.me ? openChoice() : go('login')) })
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

function invalid(key, msg) {
  S.error = msg; draw();
  const el = document.querySelector('[name="' + key + '"]');
  if (el) { el.closest('.field').classList.add('is-bad'); el.focus(); }
}

/* ---------- 2. who she is: a client signs in, a visitor just leaves her name ---------- */
function drawLogin() {
  const s = picked();
  const visitor = S.asVisitor;
  add(h('div.tabs', { role: 'tablist', style: 'margin-top:8px' }, [
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(!visitor), class: !visitor ? 'is-on' : null, text: t('I have an account'), onclick: () => { S.asVisitor = false; go('login'); } }),
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(visitor), class: visitor ? 'is-on' : null, text: t('Book as a visitor'), onclick: () => { S.asVisitor = true; go('login'); } })
  ]));
  const g = visitor ? S.visitor : S.login;
  const field = (key, label, attrs) => h('label.field', null, [h('span', { text: label }),
    h('input', { name: key, value: g[key], ...attrs, oninput: e => { g[key] = e.target.value; e.target.closest('.field').classList.remove('is-bad'); } })]);
  if (visitor) {
    title(t('Book as a visitor') + '.', t('No account needed: your name and phone. You pay for the class at the studio, in cash.'));
    add(h('form.form', { novalidate: true, onsubmit: e => { e.preventDefault(); bookAsVisitor(); } }, [
      h('div.who', null, [
        h('div.row2', null, [
          field('firstName', t('First name'), { autocomplete: 'given-name', autocapitalize: 'words', maxlength: 60 }),
          field('lastName', t('Last name'), { autocomplete: 'family-name', autocapitalize: 'words', maxlength: 60 })
        ]),
        field('phone', t('Phone number'), { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '069 123 4567', maxlength: 30 }),
        field('email', t('Email (optional)'), { type: 'email', inputmode: 'email', autocomplete: 'email', autocapitalize: 'off', spellcheck: 'false', maxlength: 200 })
      ]),
      h('button', { type: 'submit', hidden: true })
    ]));
    add(errorBox());
    if (s) add(classSummary(s));
    add(prices());
    add(policy());
    barWith([
      h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => go('pick') }),
      h('button.btn.btn--wine', { type: 'button', disabled: S.busy, text: S.busy ? t('One moment…') : t('Book the class'), onclick: bookAsVisitor })
    ]);
    return;
  }
  title(t('Sign in') + '.', t('Use the username (or email) and the DUA-… code the studio gave you.'));
  add(h('form.form', { novalidate: true, onsubmit: e => { e.preventDefault(); signIn(); } }, [
    h('div.who', null, [
      field('email', t('Username or email'), { type: 'text', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false', placeholder: 'ana.hoxha', maxlength: 200 }),
      field('password', t('Your code'), { type: 'password', autocomplete: 'current-password', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'DUA-XXXXXXXX', maxlength: 128 })
    ]),
    h('button', { type: 'submit', hidden: true })
  ]));
  add(errorBox());
  add(h('p.muted.small', { text: t('No code yet, or lost it? Ask the studio.') }));
  if (s) add(classSummary(s));
  barWith([
    h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => go('pick') }),
    h('button.btn.btn--wine', { type: 'button', disabled: S.busy, text: S.busy ? t('One moment…') : t('Sign in'), onclick: signIn })
  ]);
}

async function bookAsVisitor() {
  if (S.busy) return;
  const v = S.visitor;
  v.firstName = v.firstName.trim(); v.lastName = v.lastName.trim(); v.phone = v.phone.trim(); v.email = v.email.trim();
  if (!v.firstName) return invalid('firstName', 'Write your first name');
  if (!v.lastName) return invalid('lastName', 'Write your last name');
  if (v.phone.replace(/\D+/g, '').length < 8) return invalid('phone', 'Write a phone number we can call');
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return invalid('email', 'That email does not look right');
  const s = picked();
  S.busy = true; S.error = null; S.key = S.key || newKey(); draw();
  try {
    const r = await call('POST', '/public/visitor-bookings', { key: S.key, body: { sessionId: S.picked, ...v, email: v.email || null, lang, platform: 'WEB' } });
    S.busy = false; S.key = null;
    S.done = { session: s, visitor: v.firstName };
    loadSessions();
    go('done');
  } catch (e) {
    if (['CLASS_FULL', 'CLASS_STARTED', 'CLASS_CANCELLED', 'ALREADY_BOOKED'].includes(e.code)) { S.key = null; await loadSessions(); S.picked = null; S.view = 'pick'; }
    fail(e);
  }
}

async function signIn() {
  if (S.busy) return;
  const g = S.login;
  g.email = g.email.trim();
  // The code is handed out in capitals; a phone keyboard may not type them so.
  const password = /^dua-/i.test(g.password.trim()) ? g.password.trim().toUpperCase() : g.password;
  if (!g.email) return invalid('email', 'Write your username or email');
  if (g.email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) return invalid('email', 'That email does not look right');
  if (!password) return invalid('password', 'Write your code');
  S.busy = true; S.error = null; draw();
  try {
    const r = await call('POST', '/auth/login', { body: { email: g.email, password } });
    keepSession(r);
    await loadMe();
    S.busy = false; g.password = '';
    if (!S.me) return fail({ code: 'UNAUTHORIZED' });
    return S.picked ? openChoice() : go('pick');
  } catch (e) { fail(e); }
}

/* ---------- 3. booking it from her package ---------- */
async function openChoice() {
  S.busy = true; S.error = null; draw();
  try {
    S.detail = await call('GET', '/sessions/' + S.picked, { auth: true });
    S.busy = false; S.key = newKey();
    go('choice');
  } catch (e) {
    if (e.status === 401) { forgetSession(); S.me = null; S.busy = false; return go('login'); }
    fail(e);
  }
}

function drawChoice() {
  const s = picked(), d = S.detail;
  if (!s || !d) return go('pick');
  const credits = d.myCredits || 0;
  title(t('Book this class') + '.', d.eligible ? (credits === 1 ? t('You have 1 session in your package') : t('You have %s sessions in your package', credits)) + '.' : null);
  add(classSummary(s));
  add(errorBox());
  const run = (path, done) => async () => {
    if (S.busy) return;
    S.busy = true; S.error = null; draw();
    try {
      await call('POST', '/sessions/' + S.picked + path, { auth: true, key: S.key });
      S.busy = false;
      S.done = { session: s, ...done };
      loadSessions();
      go('done');
    } catch (e) {
      if (['CLASS_FULL', 'CLASS_STARTED', 'ALREADY_BOOKED'].includes(e.code)) { await loadSessions(); S.picked = null; S.view = 'pick'; }
      fail(e);
    }
  };
  if (!d.eligible && !d.duo) {
    add(h('div.emptybox', null, [h('p', { text: t('No sessions left in your package. Ask the studio for a new one.') }), studioLink()]));
  } else {
    if (d.duo) add(h('div.choice', null, [
      d.duo ? h('button', { type: 'button', disabled: S.busy, onclick: run('/book-duo', { duo: d.duo.partner }) }, [h('b', { text: t('Book for both of us (DUO)') }), h('span', { text: t('With %s · two places, a session from each package', d.duo.partner) })]) : null,
    ]));
    if (d.eligible) {
      add(h('div.reserve', null, [
        h('button.btn.btn--wine.btn--block', { type: 'button', disabled: S.busy, onclick: () => confirmBooking(s, credits, run('/book', {})) }, t('Reserve')),
        h('p', { text: t('1 session from your package · %s left after this', credits - 1) })
      ]));
    }
  }
  add(policy());
  barWith([h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => go('pick') })]);
}

/* "Are you sure?" before a session leaves the package. A real <dialog>: Esc and the
   backdrop close it, focus stays inside while it is open. */
function confirmBooking(s, credits, go) {
  const z = tirana(s.startsAt);
  const dlg = h('dialog.confirm', { 'aria-labelledby': 'confirm-title' });
  const close = () => { dlg.close(); };
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.append(
    h('h2', { id: 'confirm-title', text: t('Book this class?') }),
    h('p', { text: t('One class will be used from your package.') + ' ' + t('Are you sure?') }),
    h('p.confirm__class', null, [h('b', { text: className(s) }), h('span', { text: longDate(z.date) + ' · ' + z.time })]),
    h('p.confirm__left', { text: t('%s left after this', credits - 1) }),
    h('div.confirm__actions', null, [
      h('button.btn.btn--ghost', { type: 'button', text: t('Cancel'), onclick: close }),
      h('button.btn.btn--wine', { type: 'button', text: t('Yes, book'), onclick: () => { close(); go(); } })
    ])
  );
  document.body.appendChild(dlg);
  dlg.showModal();
}

/* ---------- 4. booked ---------- */
function drawDone() {
  const d = S.done;
  if (!d) return go('pick');
  const name = d.visitor || (S.me && S.me.profile && S.me.profile.firstName) || '';
  title(t('Booked') + '.');
  add(h('div.done', null, [
    h('p.lede', { style: 'margin:0 auto', text: d.duo ? t('See you both there, %s and %s!', name, d.duo) : t('See you there, %s!', name) }),
    h('p.lede', { style: 'margin:8px auto 0', text: d.visitor ? t('Your place is confirmed. You pay at the studio, in cash. To change or cancel it, message the studio.') : t('Your place is confirmed.') })
  ]));
  add(classSummary(d.session, d.visitor ? [] : [[t('Payment'), t('From your package')]]));
  if (d.visitor) add(prices());
  add(policy());
  barWith([
    d.visitor ? studioLink() : h('button.btn.btn--ghost', { type: 'button', text: t('My bookings'), onclick: openMine }),
    h('button.btn.btn--wine', { type: 'button', text: t('Book another class'), onclick: () => { S.picked = null; S.done = null; go('pick'); } })
  ]);
}

/* ---------- my bookings ---------- */
async function openMine() {
  S.view = 'mine'; S.mine = null; S.error = null; draw();
  try { S.mine = await call('GET', '/me/bookings?scope=upcoming', { auth: true }); }
  catch (e) { if (e.status === 401) { forgetSession(); S.me = null; return go('login'); } return fail(e); }
  draw();
}

function drawMine() {
  title(t('My bookings') + '.');
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
      h('span.muted.small', { text: className(s) + (s.instructor ? ' · ' + t('with %s', s.instructor.name) : '') }),
      b.canCancel ? h('div.actions', null, [
        h('span.small.muted', { text: free ? t('Free cancellation until %s.', whenShort(b.freeCancelUntil)) : t('It is past the free cancellation time: if you cancel, the session is used.') }),
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
    S.info = r.status === 'LATE_CANCELLED' ? t('Cancelled late: the session is used.') : r.refunded ? t('Cancelled. The session is back in your package.') : t('Cancelled.');
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

/* ---------- loading ---------- */
async function loadSessions() {
  S.from = tirana(new Date()).date;
  S.to = plusDays(S.from, 30);
  try {
    const r = await call('GET', '/public/sessions?from=' + S.from + '&to=' + S.to);
    S.sessions = r.sessions;
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
  draw();
  call('GET', '/public/studio').then(st => { S.cancelHours = st.policies.freeCancelHours; draw(); }, () => {});
  await Promise.all([loadSessions(), loadMe()]);
  draw();
})();
