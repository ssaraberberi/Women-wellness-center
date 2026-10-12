/* ============================================================
   DUA — the booking page
   ------------------------------------------------------------
   Four steps and nothing else: choose, schedule, details, done.
   No account and no password — a name and a phone number. What
   comes back is a reference and a private link, and the link is
   how she returns: to see her credits, book the rest of her
   package, or cancel in time.

   The page predicts; the server decides. Places, credits, the
   opening date, offer limits and the 30-minute rule are all
   checked again on the server, and whatever it says wins.
   ============================================================ */

const STUDIO_WA = '355697104072';

/* ---------- words ---------- */
const SQ = {
  'Choose your experience': 'Zgjidh eksperiencën',
  'Choose your schedule': 'Zgjidh orarin',
  'Your details': 'Të dhënat e tua',
  'Confirmation': 'Konfirmimi',
  'Step %s of %s': 'Hapi %s nga %s',
  'Pick a day, then a time.': 'Zgjidh një ditë, pastaj orën.',
  'No need to pick times now. Once the studio confirms, you choose your classes from your reservation link, or we arrange them with you.':
    'Nuk ke nevojë të zgjedhësh oraret tani. Pasi studioja ta konfirmojë, i zgjedh klasat nga linku i rezervimit, ose i rregullojmë bashkë.',
  'Previous month': 'Muaji i kaluar', 'Next month': 'Muaji tjetër', 'Free places': 'Vende të lira',
  'Regular price': 'Çmimi i rregullt', 'Discount %s': 'Zbritje %s', 'Offer saving': 'Kursimi me ofertë',
  'A single class, a monthly membership, a class pack, or one of this month’s offers.':
    'Një klasë e vetme, një abonim mujor, një paketë klasash, ose një nga ofertat e muajit.',
  'Offers': 'Oferta', 'Single class': 'Klasë e vetme', 'Monthly memberships': 'Abonime mujore', 'Class packages': 'Paketa klasash',
  'class': 'klasë', 'classes': 'klasa',
  'Valid %s days': 'Vlen %s ditë',
  'Price at the studio': 'Çmimi në studio',
  'per person': 'për person', 'for two': 'për dy',
  'For two people': 'Për dy persona',
  'Until %s': 'Deri më %s',
  '%s left': 'Kanë mbetur %s', '1 left': 'Ka mbetur 1',
  '%s off': '%s ulje',
  '+%s bonus class': '+%s klasë bonus',
  'Choose the package it applies to': 'Zgjidh paketën ku zbatohet',
  'Continue': 'Vazhdo', 'Back': 'Kthehu',
  'Pick up to %s classes. You can reserve some now and schedule the rest later.':
    'Zgjidh deri në %s klasa. Mund të rezervosh disa tani dhe pjesën tjetër më vonë.',
  'Pick your class.': 'Zgjidh klasën tënde.',
  'Every class you pick is booked for both of you.': 'Çdo klasë që zgjedh rezervohet për të dyja.',
  'selected': 'të zgjedhura', 'to schedule later': 'për më vonë',
  'Selected': 'Të zgjedhura',
  'Full': 'Plot', '%s places': '%s vende', '1 place': '1 vend', 'Needs two places': 'Duhen dy vende',
  'Nothing on this day.': 'Asgjë këtë ditë.',
  'No classes are open for booking yet. Message us and we will save you a place.':
    'Ende nuk ka klasa të hapura për rezervim. Na shkruaj dhe të ruajmë një vend.',
  'with %s': 'me %s',
  'Reserve without a time': 'Rezervo pa orar',
  'Full name': 'Emri i plotë', 'Phone number': 'Numri i telefonit', 'Email': 'Email',
  'optional': 'opsionale',
  'Preferred times or anything we should know': 'Oraret e preferuara ose diçka që duhet të dimë',
  'You': 'Ti', 'Person 1': 'Personi 1', 'Person 2': 'Personi 2', 'Your friend': 'Shoqja jote',
  'We use it only to confirm your reservation.': 'E përdorim vetëm për të konfirmuar rezervimin.',
  'For the confirmation and your link.': 'Për konfirmimin dhe linkun tënd.',
  'Your friend needs to be new to DUA.': 'Shoqja jote duhet të jetë e re në DUA.',
  'Write the full name': 'Shkruaj emrin e plotë',
  'Write a phone number we can call': 'Shkruaj një numër telefoni ku të marrim',
  'That email does not look right': 'Ky email nuk duket i saktë',
  'Confirm reservation': 'Konfirmo rezervimin', 'One moment…': 'Një moment…',
  'Cancellation Policy': 'Politika e anulimit',
  'Package': 'Paketa', 'Total': 'Totali', 'Classes': 'Klasat', 'Included': 'Të përfshira', 'Remaining to schedule': 'Për t’u caktuar',
  'Status': 'Statusi', 'Payment': 'Pagesa', 'Name': 'Emri', 'Names': 'Emrat',
  'Paid at the studio': 'Paguhet në studio', 'Paid': 'Paguar', 'Unpaid': 'Pa paguar',
  'Pending': 'Në pritje', 'Confirmed': 'Konfirmuar', 'Cancelled': 'Anuluar', 'Completed': 'Përfunduar',
  'None yet': 'Asnjë ende',
  'Your reservation is in.': 'Rezervimi yt u mor.',
  'Pending approval: the studio will confirm it shortly. Payment is made at the studio.':
    'Në pritje të konfirmimit: studioja do ta konfirmojë së shpejti. Pagesa bëhet në studio.',
  'Your reference': 'Referenca jote',
  'Keep this link': 'Ruaje këtë link',
  'It is the key to your reservation: book the rest of your classes, see your credits, or cancel in time.':
    'Është çelësi i rezervimit tënd: rezervo klasat e tjera, shiko kreditet, ose anulo në kohë.',
  'Copy': 'Kopjo', 'Copied': 'U kopjua',
  'Open my reservation': 'Hap rezervimin', 'Message the studio': 'Shkruaji studios',
  'Back to the website': 'Kthehu te faqja',
  'Your reservation': 'Rezervimi yt',
  'Total classes': 'Gjithsej', 'Reserved': 'Të rezervuara', 'To schedule': 'Për t’u caktuar',
  'Valid %s – %s': 'Vlen %s – %s', 'This package has ended.': 'Kjo paketë ka mbaruar.',
  'Upcoming classes': 'Klasat në vijim', 'Past and cancelled': 'Të shkuarat dhe të anuluarat',
  'Book my remaining classes': 'Rezervo klasat e mbetura', 'Book these classes': 'Rezervo këto klasa',
  'Cancel': 'Anulo', 'Tap again to cancel': 'Shtyp sërish për të anuluar',
  'You can cancel until %s.': 'Mund ta anulosh deri në %s.',
  'The cancellation deadline has passed. This class counts as taken.': 'Afati i anulimit ka kaluar. Kjo klasë llogaritet e zhvilluar.',
  'Cancelled in time': 'Anuluar në kohë', 'Late cancellation': 'Anulim i vonë', 'Cancelled by the studio': 'Anuluar nga studioja',
  'Attended': 'Marrë pjesë', 'No-show': 'Nuk erdhi', 'Booked': 'Rezervuar',
  'Cancelled — the class is back in your package.': 'U anulua — klasa u kthye në paketën tënde.',
  'Booked.': 'U rezervua.',
  'That link is not valid': 'Ky link nuk është i vlefshëm',
  'This link does not open a reservation. Ask the studio to send you a new one.':
    'Ky link nuk hap asnjë rezervim. Kërkoji studios të të dërgojë një të ri.',
  'Something went wrong': 'Diçka shkoi keq',
  'Opening %s — Reserve your spot early.': 'Hapemi më %s — rezervo vendin tënd që herët.',
  'Make a new reservation': 'Bëj një rezervim të ri',
  /* What the server says */
  'Class is full': 'Klasa është plot', 'Choose a package': 'Zgjidh një paketë',
  'This offer has reached its limit': 'Kjo ofertë ka arritur kufirin',
  'This offer is no longer available': 'Kjo ofertë nuk është më e disponueshme',
  'This offer is for new clients': 'Kjo ofertë është për kliente të reja',
  'This offer has already been used with this phone number': 'Kjo ofertë është përdorur tashmë me këtë numër telefoni',
  'Your friend has already been to DUA, so this offer does not apply': 'Shoqja jote ka qenë tashmë në DUA, ndaj oferta nuk zbatohet',
  'Your friend has already been part of this offer': 'Shoqja jote ka qenë tashmë pjesë e kësaj oferte',
  'Your friend needs her own phone number': 'Shoqja jote duhet të ketë numrin e saj',
  'The two people need different phone numbers': 'Dy personat duhet të kenë numra të ndryshëm',
  'That is more classes than the package has left': 'Janë më shumë klasa se sa ka mbetur në paketë',
  'Classes start when the studio opens': 'Klasat fillojnë kur hapet studioja',
  'This class has already started': 'Kjo klasë ka filluar',
  'It is too late to cancel this class. It counts as used.': 'Është vonë për ta anuluar këtë klasë. Llogaritet e përdorur.',
  'Too many requests. Try again in a little while.': 'Shumë kërkesa. Provo sërish pas pak.',
  'This offer does not apply to that package': 'Kjo ofertë nuk zbatohet për atë paketë',
  'This reservation is closed': 'Ky rezervim është mbyllur'
};
const DAYS = { sq: ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'],
               en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const DAYS3 = { sq: ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
const MONTHS = { sq: ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'],
                 en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
const POLICY = {
  sq: 'Ju mund ta anuloni rezervimin tuaj deri në %s minuta përpara fillimit të klasës. Pas këtij afati, klasa konsiderohet e zhvilluar dhe nuk rimbursohet në abonimin tuaj.',
  en: 'You can cancel your reservation up to %s minutes before the class starts. After that, the class counts as taken and is not returned to your package.'
};

let lang = 'sq';
try { lang = localStorage.getItem('dua-lang') === 'en' ? 'en' : 'sq'; } catch (e) {}
function t(key, ...args) {
  let s = lang === 'sq' && SQ[key] !== undefined ? SQ[key] : key;
  args.forEach(a => { s = s.replace('%s', a); });
  return s;
}
const ser = msg => t(String(msg || 'Something went wrong'));

/* ---------- dates, in the studio's timezone ---------- */
const day = d => new Date(d + 'T00:00:00');
const longDate = d => { const x = day(d); return lang === 'sq' ? DAYS.sq[x.getDay()] + ', ' + x.getDate() + ' ' + MONTHS.sq[x.getMonth()] : DAYS.en[x.getDay()] + ', ' + MONTHS.en[x.getMonth()] + ' ' + x.getDate(); };
const dayMonth = d => { const x = day(d); return lang === 'sq' ? x.getDate() + ' ' + MONTHS.sq[x.getMonth()] : MONTHS.en[x.getMonth()] + ' ' + x.getDate(); };
const plusDays = (d, n) => { const x = day(d); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const tirana = iso => {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).forEach(x => { p[x.type] = x.value; });
  return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
};
const money = n => n == null ? null : Number(n).toLocaleString('en-US') + ' ALL';

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
    else if (k === 'disabled' || k === 'hidden' || k === 'checked') n[k] = !!v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(c => {
    if (c == null || c === false) return;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return n;
}
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
const icon = svg => { const s = h('span'); s.innerHTML = svg; return s.firstChild; };

async function api(path, body) {
  const res = await fetch('/api' + path, body === undefined ? { headers: { accept: 'application/json' } } : {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-dua-lang': lang }, body: JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const e = new Error((data && data.error) || 'Something went wrong'); e.code = data && data.code; e.status = res.status; throw e; }
  return data;
}

/* ---------- state ---------- */
const S = {
  token: null, cat: null, cls: null, step: 1, choice: null, picked: new Set(), day: null,
  people: [{ name: '', phone: '', email: '' }, { name: '', phone: '' }], friend: { name: '', phone: '' }, notes: '',
  error: null, busy: false, result: null, view: null, person: 0, more: false, flash: null, armed: null
};
const app = document.getElementById('app');
const add = node => { if (node) app.appendChild(node); };
const bar = document.getElementById('bar');

/* What has been chosen, worked out once for every step that needs it. */
function chosen() {
  if (!S.choice || !S.cat) return null;
  const offer = S.choice.offerId ? S.cat.offers.find(o => o.id === S.choice.offerId) : null;
  const plan = S.choice.planId ? S.cat.plans.find(p => p.id === S.choice.planId) : null;
  if (offer && offer.kind !== 'bundle' && !plan) return { offer, incomplete: true };
  if (!offer && !plan) return null;
  const bundle = offer && offer.kind === 'bundle';
  const lines = bundle ? offer.lines : plan.lines;
  const credits = lines.some(l => l.total == null) ? 99 : lines.reduce((n, l) => n + l.total, 0);
  const types = [...new Set(lines.flatMap(l => l.types))];
  const persons = bundle ? offer.persons : 1;
  const together = persons === 1 || offer.together;
  const pct = offer && offer.kind === 'discount' ? offer.discountPct || 0 : 0;
  const base = bundle ? offer.price : plan.price;
  const unit = base == null ? null : Math.round(base * (100 - pct) / 100);
  return {
    offer, plan, bundle, lines, credits, types, persons, together,
    title: !offer ? plan.name : bundle ? offer.title : plan.name + ' · ' + offer.title,
    unit, total: unit == null ? null : unit * persons,
    original: bundle ? offer.original : (pct ? base : null),
    single: !!plan && plan.kind === 'single' && !bundle,
    friend: !!offer && offer.kind === 'bonus' && offer.friendRequired,
    validityDays: bundle ? offer.validityDays : plan.validityDays
  };
}

/* ---------- the page ---------- */
function draw() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-lang]').forEach(b => {
    b.classList.toggle('is-on', b.dataset.lang === lang);
    b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
  });
  const opening = document.getElementById('opening');
  const st = S.cat ? S.cat.settings : (S.cls ? { openingDate: S.cls.openingDate, today: null } : null);
  if (st && st.today && st.today < st.openingDate) {
    opening.hidden = false;
    opening.querySelector('span').textContent = t('Opening %s — Reserve your spot early.', dayMonth(st.openingDate));
  } else opening.hidden = true;

  app.textContent = '';
  bar.querySelector('.bar__in').textContent = '';
  bar.hidden = true;
  if (S.token) return drawManage();
  if (!S.cat) { app.appendChild(h('p.loading', null, '…')); return; }
  if (S.step === 1) drawChoose();
  else if (S.step === 2) drawSchedule();
  else if (S.step === 3) drawDetails();
  else drawDone();
}

/* A single class is booked for a day and a time. Anything bigger is
   reserved without one: the times are arranged afterwards, from her link
   or with the studio, so the schedule step is left out. */
const flow = () => { const x = chosen(); return x && !x.incomplete && !x.single ? [1, 3, 4] : [1, 2, 3, 4]; };
function header(n, title, lede) {
  const steps = flow(), at = steps.indexOf(n) + 1;
  app.appendChild(h('div.steps', { 'aria-hidden': 'true' }, steps.map((s, i) => h('span', { class: i < at ? 'is-on' : null }))));
  app.appendChild(h('p.eyebrow.stepname', { text: t('Step %s of %s', at, steps.length) }));
  app.appendChild(h('h1.title', null, title));
  if (lede) app.appendChild(h('p.lede', { text: lede }));
}
function barWith(kids) {
  bar.hidden = false;
  const inner = bar.querySelector('.bar__in');
  inner.textContent = '';
  kids.filter(Boolean).forEach(k => inner.appendChild(k));
}
function errorBox() { return S.error ? h('p.notice', { role: 'alert', text: ser(S.error) }) : null; }

/* ---------- 1. choose ---------- */
function drawChoose() {
  header(1, t('Choose your experience') + '.', t('A single class, a monthly membership, a class pack, or one of this month’s offers.'));
  const { plans, offers } = S.cat;
  const c = S.choice || {};

  const priceBlock = (price, original, sub) => price == null
    ? h('p.card__soon', { text: t('Price at the studio') })
    : h('p.card__price', null, [original ? h('s', { text: money(original) }) : null, money(price), sub ? h('small', { text: sub }) : null]);
  const count = lines => {
    const n = lines.some(l => l.total == null) ? '∞' : lines.reduce((s, l) => s + l.total, 0);
    return h('p.card__big', null, [String(n), h('small', { text: n === 1 ? t('class') : t('classes') })]);
  };

  if (offers.length) {
    const box = h('section.group', null, [h('span.eyebrow', { text: t('Offers') })]);
    const grid = h('div.cards');
    offers.forEach(o => {
      const on = c.offerId === o.id;
      const meta = [
        o.persons === 2 ? h('span.badge', { text: t('For two people') }) : null,
        o.kind === 'discount' && o.discountPct ? h('span.badge', { text: t('%s off', o.discountPct + '%') }) : null,
        o.kind === 'bonus' && o.bonusClasses ? h('span.badge', { text: t('+%s bonus class', o.bonusClasses) }) : null,
        o.remaining != null ? h('span', { text: o.remaining === 1 ? t('1 left') : t('%s left', o.remaining) }) : null,
        o.endsOn ? h('span', { text: t('Until %s', dayMonth(o.endsOn)) }) : null
      ];
      const card = h('button.card.offer', { type: 'button', class: on ? 'is-on' : null, 'aria-pressed': on ? 'true' : 'false',
        onclick: () => { S.choice = { offerId: o.id, planId: o.kind === 'bundle' ? null : (on ? c.planId : null) }; S.error = null; draw(); } }, [
        h('span.card__tick', null, icon(ICON_CHECK)),
        h('div.card__row', null, [
          h('div', null, [h('p.card__name', { text: o.title }), o.kind === 'bundle' ? count(o.lines) : null]),
          o.kind === 'bundle' ? priceBlock(o.price, o.original, o.persons === 2 ? t('per person') : null) : null
        ]),
        pickText(o, 'description') ? h('p.card__text', { text: pickText(o, 'description') }) : null,
        pickText(o, 'eligibility') ? h('p.card__text.small', { style: 'opacity:.85', text: pickText(o, 'eligibility') }) : null,
        h('div.card__meta', null, meta)
      ]);
      grid.appendChild(card);
      if (on && o.kind !== 'bundle') {
        const eligible = plans.filter(p => o.eligiblePlans.includes(p.id));
        grid.appendChild(h('div.sub', null, [
          h('span.eyebrow', { text: t('Choose the package it applies to') }),
          h('div.pills', null, eligible.map(p => {
            const pct = o.kind === 'discount' ? o.discountPct || 0 : 0;
            const price = p.price == null ? null : Math.round(p.price * (100 - pct) / 100);
            return h('button.pill', { type: 'button', class: c.planId === p.id ? 'is-on' : null, 'aria-pressed': c.planId === p.id ? 'true' : 'false',
              onclick: () => { S.choice = { offerId: o.id, planId: p.id }; draw(); } },
              [p.name, h('small', null, [
                price != null && pct ? h('s', { text: money(p.price) }) : null,
                price != null ? h('b.pill__now', { text: money(price) }) : null,
                (price != null ? ' · ' : '') + linesText(p.lines)])]);
          }))
        ]));
      }
    });
    box.appendChild(grid);
    app.appendChild(box);
  }

  const group = (label, list) => {
    if (!list.length) return;
    app.appendChild(h('section.group', null, [
      h('span.eyebrow', { text: label }),
      h('div.cards' + (list.length > 1 ? '.cards--2' : ''), null, list.map(p => {
        const on = !c.offerId && c.planId === p.id;
        return h('button.card', { type: 'button', class: on ? 'is-on' : null, 'aria-pressed': on ? 'true' : 'false',
          onclick: () => { S.choice = { planId: p.id }; S.error = null; draw(); } }, [
          h('span.card__tick', null, icon(ICON_CHECK)),
          h('div.card__row', null, [h('div', null, [h('p.card__name', { text: p.name }), count(p.lines)]), priceBlock(p.price)]),
          pickText(p, 'tagline') ? h('p.card__text', { text: pickText(p, 'tagline') }) : null,
          h('div.card__meta', null, [h('span', { text: t('Valid %s days', p.validityDays) }), p.featured ? h('span.badge.badge--soft', { text: '★' }) : null])
        ]);
      }))
    ]));
  };
  group(t('Single class'), plans.filter(p => p.kind === 'single'));
  group(t('Monthly memberships'), plans.filter(p => p.kind === 'membership'));
  group(t('Class packages'), plans.filter(p => p.kind === 'package'));
  if (!plans.length && !offers.length) app.appendChild(h('p.empty', { text: t('No classes are open for booking yet. Message us and we will save you a place.') }));

  const x = chosen();
  barWith([h('button.btn.btn--wine', { type: 'button', disabled: !x || x.incomplete, text: t('Continue'),
    onclick: () => { S.picked = new Set(); S.step = x.single ? 2 : 3; S.error = null; draw(); window.scrollTo(0, 0); } })]);
}
const pickText = (p, f) => (lang === 'en' ? ((p.en || {})[f] || p[f]) : (p[f] || (p.en || {})[f])) || '';
const linesText = lines => lines.map(l => (l.total == null ? '∞' : l.total) + ' ' + (l.total === 1 ? t('class') : t('classes'))).join(' + ');

/* ---------- 2. schedule ---------- */
function eligibleClasses(x, cls) {
  return (cls ? cls.classes : []).filter(k => x.types.includes(k.typeId));
}

function scheduler(x, max, seats, onChange) {
  const box = h('div');
  const list = eligibleClasses(x, S.cls);
  if (!list.length) { box.appendChild(h('p.empty', { text: t('No classes are open for booking yet. Message us and we will save you a place.') })); return box; }

  const dates = [];
  for (let d = S.cls.from; d <= S.cls.to; d = plusDays(d, 1)) dates.push(d);
  const byDate = d => list.filter(k => k.date === d);
  if (!S.day || !dates.includes(S.day) || !byDate(S.day).length) S.day = dates.find(d => byDate(d).length) || dates[0];

  const counter = h('div.counter', { 'aria-live': 'polite' }, [
    h('span', null, [h('b', { text: String(S.picked.size) }), ' ', t('selected')]),
    max < 99 ? h('span', null, [h('b', { text: String(Math.max(0, max - S.picked.size)) }), ' ', t('to schedule later')]) : null
  ]);
  if (max > 1) box.appendChild(counter);

  box.appendChild(calendar(dates, byDate, seats, onChange));

  box.appendChild(h('h2.display', { style: 'font-size:1.25rem;margin-top:14px', text: longDate(S.day) }));
  const slots = h('div.slots');
  const today = byDate(S.day);
  if (!today.length) slots.appendChild(h('p.empty', { text: t('Nothing on this day.') }));
  today.forEach(k => {
    const on = S.picked.has(k.id);
    const room = k.left >= seats;
    const cap = !on && S.picked.size >= max;
    const label = k.left <= 0 ? t('Full') : !room ? t('Needs two places') : k.left === 1 ? t('1 place') : t('%s places', k.left);
    slots.appendChild(h('button.slot', { type: 'button', class: (on ? 'is-on' : '') + (k.left <= 2 && room ? ' is-few' : ''),
      disabled: (!room && !on) || cap, 'aria-pressed': on ? 'true' : 'false',
      onclick: () => { if (on) S.picked.delete(k.id); else if (max === 1) { S.picked = new Set([k.id]); } else S.picked.add(k.id); onChange(); } }, [
      h('span.slot__time', { text: k.start + '–' + k.end }),
      h('span.slot__what', null, [h('b', { text: typeName(k.typeId) }), k.instructor ? h('span', { text: t('with %s', k.instructor) }) : null]),
      h('span.slot__left', { text: label }),
      h('span.slot__box', { 'aria-hidden': 'true' }, on ? icon(ICON_CHECK) : null)
    ]));
  });
  box.appendChild(slots);

  if (S.picked.size) {
    const picked = list.filter(k => S.picked.has(k.id)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    box.appendChild(h('section.chosen', null, [
      h('p.eyebrow', { text: t('Selected') }),
      h('ul', null, picked.map(k => h('li', null, [
        h('span.num', { text: longDate(k.date) + ' · ' + k.start }),
        h('button.x', { type: 'button', 'aria-label': t('Cancel'), onclick: () => { S.picked.delete(k.id); onChange(); } }, icon(ICON_X))
      ])))
    ]));
  }
  return box;
}
/* A month on a page, Monday first: the days with a free place carry a
   dot, the chosen day is filled, and the arrows go no further than the
   classes do. */
function calendar(dates, byDate, seats, onChange) {
  const first = dates[0].slice(0, 7), last = dates[dates.length - 1].slice(0, 7);
  if (!S.month || S.month < first || S.month > last) S.month = S.day.slice(0, 7);
  const y = +S.month.slice(0, 4), m = +S.month.slice(5, 7) - 1;
  const today = tirana(new Date()).date;
  const shift = n => {
    const x = new Date(y, m + n, 1);
    S.month = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
    const open = dates.find(d => d.startsWith(S.month) && byDate(d).some(k => k.left >= seats));
    if (open) S.day = open;
    onChange();
  };
  const arrow = (n, label, path) => {
    const b = h('button.cal__nav', { type: 'button', 'aria-label': label, disabled: n < 0 ? S.month <= first : S.month >= last, onclick: () => shift(n) });
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
    return b;
  };
  const grid = h('div.cal__grid', { role: 'grid' });
  [1, 2, 3, 4, 5, 6, 0].forEach(i => grid.appendChild(h('span.cal__wd', { text: DAYS3[lang][i].slice(0, lang === 'sq' ? 3 : 2) })));
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid.appendChild(h('span.cal__pad', { 'aria-hidden': 'true' }));
  const count = new Date(y, m + 1, 0).getDate();
  for (let n = 1; n <= count; n++) {
    const d = S.month + '-' + String(n).padStart(2, '0');
    const list = dates.includes(d) ? byDate(d) : [];
    const free = list.some(k => k.left >= seats);
    const mine = list.some(k => S.picked.has(k.id));
    const cls = [d === S.day ? 'is-on' : '', free ? 'has-room' : '', list.length && !free ? 'is-full' : '',
                 mine ? 'is-picked' : '', d === today ? 'is-today' : ''].filter(Boolean).join(' ');
    grid.appendChild(h('button.cal__day', { type: 'button', class: cls || null, disabled: !list.length,
      'aria-label': longDate(d), 'aria-pressed': d === S.day ? 'true' : 'false',
      onclick: () => { S.day = d; onChange(); } }, [h('span', { text: String(n) }), h('i', { 'aria-hidden': 'true' })]));
  }
  return h('div.cal', null, [
    h('div.cal__head', null, [arrow(-1, t('Previous month'), 'm15 6-6 6 6 6'), h('b', { text: MONTHS[lang][m] + ' ' + y }), arrow(1, t('Next month'), 'm9 6 6 6-6 6')]),
    grid,
    h('div.cal__key', null, [h('span', null, [h('i.k-room'), t('Free places')]), h('span', null, [h('i.k-full'), t('Full')])])
  ]);
}
const typeName = id =>((S.cat && S.cat.classTypes) || []).find(t0 => t0.id === id)?.short || (id === 'spa' ? 'Spa' : 'Reformer');

function drawSchedule() {
  const x = chosen();
  if (!x.single) { S.step = 3; return draw(); }
  header(2, t('Choose your schedule') + '.', t('Pick a day, then a time.'));
  add(errorBox());
  app.appendChild(scheduler(x, 1, 1, () => draw()));
  const go = h('button.btn.btn--wine', { type: 'button', disabled: !S.picked.size, text: t('Continue'),
    onclick: () => { S.step = 3; S.error = null; draw(); window.scrollTo(0, 0); } });
  barWith([h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => { S.step = 1; draw(); } }), go]);
}

/* ---------- 3. details ---------- */
function drawDetails() {
  const x = chosen();
  header(3, t('Your details') + '.', x.single ? null : t('No need to pick times now. Once the studio confirms, you choose your classes from your reservation link, or we arrange them with you.'));
  const inputs = {};
  const fieldBox = (key, obj, prop, label, attrs, hint) => {
    const inp = h('input', { name: key, value: obj[prop] || '', ...attrs, oninput: e => { obj[prop] = e.target.value; } });
    inputs[key] = inp;
    return h('label.field', null, [h('span', null, [label, hint ? h('i', { text: ' · ' + hint }) : null]), inp]);
  };
  const who = (i, label) => h('div.who', null, [
    h('span.eyebrow', { text: label }),
    fieldBox('p' + i + '-name', S.people[i], 'name', t('Full name'), { autocomplete: i === 0 ? 'name' : 'off', autocapitalize: 'words', required: true }),
    fieldBox('p' + i + '-phone', S.people[i], 'phone', t('Phone number'), { type: 'tel', inputmode: 'tel', autocomplete: i === 0 ? 'tel' : 'off', required: true }),
    i === 0 ? fieldBox('p0-email', S.people[0], 'email', t('Email'), { type: 'email', inputmode: 'email', autocomplete: 'email', autocapitalize: 'off', spellcheck: 'false' }, t('optional')) : null,
    i === 0 ? h('p.muted.small', { text: t('For the confirmation and your link.') }) : null
  ]);

  const form = h('form.form', { novalidate: true, onsubmit: e => { e.preventDefault(); submit(); } }, [
    who(0, x.persons === 2 ? t('Person 1') : t('You')),
    x.persons === 2 ? who(1, t('Person 2')) : null,
    x.friend ? h('div.who', null, [
      h('span.eyebrow', { text: t('Your friend') }),
      fieldBox('friend-name', S.friend, 'name', t('Full name'), { autocomplete: 'off', autocapitalize: 'words' }),
      fieldBox('friend-phone', S.friend, 'phone', t('Phone number'), { type: 'tel', inputmode: 'tel', autocomplete: 'off' }),
      h('p.muted.small', { text: t('Your friend needs to be new to DUA.') })
    ]) : null,
    h('label.field', null, [h('span', null, [t('Preferred times or anything we should know'), h('i', { text: ' · ' + t('optional') })]),
      h('textarea', { name: 'notes', rows: 3, maxlength: 500, oninput: e => { S.notes = e.target.value; } }, S.notes)])
  ]);
  app.appendChild(form);
  app.appendChild(summary(x));
  app.appendChild(policy());
  add(errorBox());

  const btn = h('button.btn.btn--wine', { type: 'button', disabled: S.busy, text: S.busy ? t('One moment…') : t('Confirm reservation'), onclick: () => submit() });
  barWith([h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => { S.step = x.single ? 2 : 1; S.error = null; draw(); } }), btn]);

  async function submit() {
    S.error = null;
    const bad = (key, msg) => { S.error = msg; draw(); const el = document.querySelector('[name="' + key + '"]'); if (el) { el.closest('.field').classList.add('is-bad'); el.focus(); } };
    const digits = s => String(s || '').replace(/\D+/g, '');
    for (let i = 0; i < x.persons; i++) {
      if (String(S.people[i].name || '').trim().length < 2) return bad('p' + i + '-name', 'Write the full name');
      if (digits(S.people[i].phone).length < 8) return bad('p' + i + '-phone', 'Write a phone number we can call');
    }
    if (S.people[0].email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.people[0].email.trim())) return bad('p0-email', 'That email does not look right');
    if (x.friend) {
      if (String(S.friend.name || '').trim().length < 2) return bad('friend-name', 'Write the full name');
      if (digits(S.friend.phone).length < 8) return bad('friend-phone', 'Write a phone number we can call');
    }
    S.busy = true; draw();
    try {
      const out = await api('/public/reservations', {
        planId: x.plan ? x.plan.id : null, offerId: x.offer ? x.offer.id : null,
        people: S.people.slice(0, x.persons), friend: x.friend ? S.friend : null,
        classIds: x.single ? [...S.picked] : [], notes: S.notes
      });
      S.result = out; S.step = 4;
      try { history.replaceState({}, '', '/book?r=' + encodeURIComponent(out.token) + '&new=1'); } catch (e) {}
      refreshClasses();
    } catch (e) {
      S.error = e.message;
      if (['full', 'already', 'cancelled', 'past', 'missing', 'before-opening'].includes(e.code)) {
        await refreshClasses(); if (x.single) S.step = 2;
      }
    }
    S.busy = false; draw(); window.scrollTo(0, 0);
  }
}

function summary(x, view) {
  const rows = [];
  const row = (k, v, cls) => rows.push(h('div', { class: cls || null }, [h('span', { text: k }), typeof v === 'string' ? h('span', { text: v }) : h('span', null, v)]));
  if (view) row(view.people.length > 1 ? t('Names') : t('Name'), view.people.map(p => p.name).join(' & '));
  row(t('Package'), view ? view.title : x.title);
  const picked = view ? view.bookings.filter(b => b.status === 'booked' && (b.person === 0 || !view.together))
    : (S.cls ? S.cls.classes.filter(k => S.picked.has(k.id)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)) : []);
  if (view || x.single) row(t('Classes'), picked.length ? h('ul', null, picked.map(k => h('li', { text: dayMonth(k.date) + ' · ' + k.start }))) : t('None yet'));
  const included = view ? view.people[0].total : (x.credits >= 99 ? null : x.credits);
  if (included != null) row(t('Included'), String(included) + (view ? '' : (x.persons === 2 ? ' × 2' : '')));
  if (included != null && (view || x.single)) row(t('Remaining to schedule'), String(view ? view.people[0].left : Math.max(0, x.credits - S.picked.size)));
  /* An offer shows what it saves: the regular price struck through, the
     discount, then what she pays. */
  const persons = view ? view.persons || 1 : x.persons;
  const unit = view ? view.unitPrice : x.unit;
  const orig = view ? view.originalPrice : x.original;
  const pct = view ? view.discountPct : (x.offer && x.offer.kind === 'discount' ? x.offer.discountPct : null);
  if (unit != null && orig && orig > unit) {
    row(t('Regular price'), h('s', { text: money(orig * persons) }));
    row(pct ? t('Discount %s', pct + '%') : t('Offer saving'), '−' + money((orig - unit) * persons), 'save');
  }
  const total = view ? view.totalPrice : x.total;
  row(t('Total'), total == null ? t('Price at the studio') : money(total) + (!view && x.persons === 2 ? ' (' + t('for two') + ')' : ''), 'total');
  if (view) row(t('Status'), statusChip(view.status));
  row(t('Payment'), view && view.payment === 'paid' ? t('Paid') : t('Paid at the studio'));
  return h('div.summary', null, rows);
}
const statusChip = s => h('span.status' + (s === 'confirmed' || s === 'completed' ? '.status--good' : s === 'cancelled' ? '.status--bad' : ''),
  { text: t(s.charAt(0).toUpperCase() + s.slice(1)) });
function policy() {
  const min = (S.view || (S.result && S.result.reservation) || {}).cancelMinutes || (S.cat && S.cat.settings.cancelMinutes) || 30;
  return h('div.policy', null, [h('b', { text: t('Cancellation Policy') }), h('span', { text: POLICY[lang].replace('%s', min) })]);
}

/* ---------- 4. done ---------- */
function drawDone() {
  const r = S.result.reservation;
  header(4, t('Your reservation is in.'));
  app.appendChild(h('div.done', null, [
    h('p.eyebrow', { text: t('Your reference') }),
    h('p.ref', { text: S.result.ref }),
    h('p.lede', { style: 'margin:14px auto 0', text: r.status === 'confirmed' ? t('Confirmed') : t('Pending approval: the studio will confirm it shortly. Payment is made at the studio.') })
  ]));
  app.appendChild(summary(null, r));
  app.appendChild(keepLink(S.result.token, S.result.ref));
  app.appendChild(policy());
  barWith([
    h('a.btn.btn--ghost', { href: '/', text: '←' , 'aria-label': t('Back to the website') }),
    h('a.btn.btn--wine', { href: '/book?r=' + encodeURIComponent(S.result.token), text: t('Open my reservation') })
  ]);
}

function keepLink(token, ref) {
  const url = location.origin + '/book?r=' + encodeURIComponent(token);
  const input = h('input', { value: url, readonly: true, 'aria-label': t('Keep this link'), onfocus: e => e.target.select() });
  const copy = h('button.btn.btn--sm', { type: 'button', text: t('Copy'), onclick: async () => {
    try { await navigator.clipboard.writeText(url); } catch (e) { input.select(); document.execCommand && document.execCommand('copy'); }
    copy.textContent = t('Copied');
  } });
  const msg = (lang === 'sq' ? 'Përshëndetje! Rezervimi im: ' : 'Hello! My reservation: ') + ref;
  return h('div.keep', null, [
    h('b', { text: t('Keep this link') }),
    h('span.small', { text: t('It is the key to your reservation: book the rest of your classes, see your credits, or cancel in time.') }),
    h('div.keep__link', null, [input, copy]),
    h('a.link', { href: 'https://wa.me/' + STUDIO_WA + '?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener', text: t('Message the studio') })
  ]);
}

/* ---------- her reservation, from the link ---------- */
function drawManage() {
  const v = S.view;
  if (!v) { app.appendChild(S.error ? manageError() : h('p.loading', null, '…')); return; }
  const fresh = new URLSearchParams(location.search).get('new') === '1';

  app.appendChild(h('p.eyebrow', { text: t('Your reservation') }));
  app.appendChild(h('h1.title', { style: 'margin-top:6px', text: v.title }));
  app.appendChild(h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px' }, [
    h('span.ref', { style: 'margin:0;font-size:.95rem;padding:6px 14px', text: v.ref }),
    statusChip(v.status),
    h('span.status.status--soft', { text: v.payment === 'paid' ? t('Paid') : t('Unpaid') })
  ]));
  if (S.flash) app.appendChild(h('p.notice.notice--soft', { role: 'status', text: S.flash }));
  add(errorBox());

  const independent = v.people.length > 1 && !v.together;
  if (independent) app.appendChild(h('div.tabs', { role: 'tablist' }, v.people.map((p, i) =>
    h('button.pill', { type: 'button', class: S.person === i ? 'is-on' : null, 'aria-selected': S.person === i ? 'true' : 'false',
      onclick: () => { S.person = i; S.more = false; S.picked = new Set(); draw(); } }, p.name))));
  const p = v.people[independent ? S.person : 0];
  if (!independent && v.people.length > 1) app.appendChild(h('p.lede', { text: v.people.map(x => x.name).join(' & ') }));

  if (p.total != null) app.appendChild(h('div.credits', null, [
    h('div', null, [h('b', { text: String(p.total) }), h('span', { text: t('Total classes') })]),
    h('div', null, [h('b', { text: String(p.reserved) }), h('span', { text: t('Reserved') })]),
    h('div', null, [h('b', { text: String(p.left) }), h('span', { text: t('To schedule') })])
  ]));
  app.appendChild(h('p.muted.small', { style: 'margin-top:10px', text: p.expired ? t('This package has ended.') : t('Valid %s – %s', dayMonth(p.start), dayMonth(p.end)) }));

  const mine = v.bookings.filter(b => independent ? b.person === S.person : b.person === 0);
  const upcoming = mine.filter(b => b.status === 'booked' && !b.started && !b.classCancelled);
  const rest = mine.filter(b => !upcoming.includes(b)).reverse();

  const open = v.status !== 'cancelled' && v.status !== 'completed' && !p.expired && p.status === 'active';
  if (open && (p.left == null || p.left > 0)) {
    if (!S.more) app.appendChild(h('button.btn.btn--wine.btn--block', { type: 'button', style: 'margin-top:20px', text: t('Book my remaining classes'),
      onclick: () => { S.more = true; S.picked = new Set(); S.error = null; draw(); } }));
    else {
      const x = { types: [...new Set(p.lines.flatMap(l => l.types))] };
      const max = p.left == null ? 99 : p.left;
      app.appendChild(h('section.group', null, [scheduler(x, max, v.together ? v.people.length : 1, () => draw())]));
      barWith([
        h('button.btn.btn--ghost', { type: 'button', text: t('Back'), onclick: () => { S.more = false; S.picked = new Set(); draw(); } }),
        h('button.btn.btn--wine', { type: 'button', disabled: !S.picked.size || S.busy, text: S.busy ? t('One moment…') : t('Book these classes'),
          onclick: async () => {
            S.busy = true; S.error = null; draw();
            try {
              S.view = await api('/public/reservation/book', { token: S.token, person: S.person, classIds: [...S.picked] });
              S.flash = t('Booked.'); S.more = false; S.picked = new Set();
            } catch (e) { S.error = e.message; }
            await refreshClasses(); S.busy = false; draw(); window.scrollTo(0, 0);
          } })
      ]);
    }
  }

  app.appendChild(h('section.group', null, [
    h('span.eyebrow', { text: t('Upcoming classes') }),
    upcoming.length ? h('div.list', null, upcoming.map(b => bookingItem(b))) : h('p.muted', { text: t('None yet') })
  ]));
  if (rest.length) app.appendChild(h('section.group', null, [
    h('span.eyebrow', { text: t('Past and cancelled') }),
    h('div.list', null, rest.map(b => bookingItem(b, true)))
  ]));
  if (fresh) app.appendChild(keepLink(S.token, v.ref));
  app.appendChild(policy());
  if (!S.more) app.appendChild(h('p', { style: 'margin-top:26px;text-align:center' },
    h('a.link', { href: '/book', text: t('Make a new reservation') })));
}

function bookingItem(b, past) {
  const d = tirana(b.deadline);
  const statusText = b.classCancelled || b.status === 'released' ? t('Cancelled by the studio')
    : b.status === 'cancelled' ? t('Cancelled in time') : b.status === 'late' ? t('Late cancellation')
    : b.attendance === 'attended' ? t('Attended') : b.attendance === 'noshow' ? t('No-show') : t('Booked');
  const armed = S.armed === b.id;
  return h('div.item' + (past ? '.item--past' : ''), null, [
    h('div.item__top', null, [
      h('div.item__when', null, [h('b', { text: longDate(b.date) }), h('span.small.muted', { text: b.start + '–' + b.end + ' · ' + b.typeName + (b.instructor ? ' · ' + t('with %s', b.instructor) : '') })]),
      past ? h('span.status.status--soft', { text: statusText })
        : b.canCancel ? h('button.btn.btn--sm' + (armed ? '.btn--wine' : '.btn--ghost'), { type: 'button', text: armed ? t('Tap again to cancel') : t('Cancel'),
            onclick: async () => {
              if (!armed) { S.armed = b.id; draw(); return; }
              S.armed = null; S.error = null;
              try { S.view = await api('/public/reservation/cancel', { token: S.token, bookingId: b.id }); S.flash = t('Cancelled — the class is back in your package.'); }
              catch (e) { S.error = e.message; S.view = await api('/public/reservation', { token: S.token }).catch(() => S.view); }
              await refreshClasses(); draw();
            } })
        : h('span.status.status--soft', { text: t('Booked') })
    ]),
    !past ? h('p.item__note', { text: b.canCancel
      ? t('You can cancel until %s.', d.time + (d.date !== b.date ? ', ' + dayMonth(d.date) : ''))
      : t('The cancellation deadline has passed. This class counts as taken.') }) : null
  ]);
}
function manageError() {
  return h('div', null, [
    h('h1.title', { text: t('That link is not valid') }),
    h('p.lede', { text: t('This link does not open a reservation. Ask the studio to send you a new one.') }),
    h('p', { style: 'margin-top:20px' }, h('a.btn.btn--wine', { href: '/book', text: t('Make a new reservation') }))
  ]);
}

/* ---------- loading ---------- */
async function refreshClasses() {
  try { S.cls = await api('/public/classes'); } catch (e) {}
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if (!b) return;
  lang = b.dataset.lang === 'en' ? 'en' : 'sq';
  try { localStorage.setItem('dua-lang', lang); } catch (x) {}
  draw();
});

(async function boot() {
  const params = new URLSearchParams(location.search);
  S.token = params.get('r');
  draw();
  try {
    if (S.token) {
      const [view, cls, cat] = await Promise.all([
        api('/public/reservation', { token: S.token }), api('/public/classes'), api('/public/book').catch(() => null)]);
      S.view = view; S.cls = cls; S.cat = cat;
    } else {
      const [cat, cls] = await Promise.all([api('/public/book'), api('/public/classes')]);
      S.cat = cat; S.cls = cls;
      /* A link from the website can name what to open with: ?plan=… or ?offer=… */
      const plan = params.get('plan'), offer = params.get('offer');
      if (offer && cat.offers.some(o => o.id === offer)) S.choice = { offerId: offer };
      else if (plan && cat.plans.some(p => p.id === plan)) S.choice = { planId: plan };
    }
  } catch (e) { S.error = e.message; }
  draw();
})();
