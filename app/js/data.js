/* ============================================================
   DUA — domain data
   ------------------------------------------------------------
   Everything the platform knows, and the seed that makes the
   mockup open in a believable state. Class types are data, not
   code: change CLASS_TYPES and PLANS and the whole system —
   scheduling, eligibility, the calendars — follows.
   ============================================================ */

export const CLASS_TYPES = [
  { id: 'reformer', name: 'Reformer Pilates', short: 'Reformer', tone: 'wine' },
  { id: 'barre',    name: 'Barre',            short: 'Barre',    tone: 'rose' },
  { id: 'yoga',     name: 'Yoga',             short: 'Yoga',     tone: 'sand' },
  { id: 'massage',  name: 'Massage',          short: 'Massage',  tone: 'ink'  }
];

/* An allowance is "how many of these types, per period".
   limit:null means unlimited. per is 'week' or 'month' — the
   client UI words itself from whichever the plan uses. */
export const PLANS = [
  {
    id: 'essential', name: 'Essential', price: 11900,
    blurb: 'Reformer, eight times a month.',
    allowances: [ { types: ['reformer'], limit: 8, per: 'month' } ]
  },
  {
    id: 'signature', name: 'Signature', price: 16900, featured: true,
    blurb: 'Reformer twelve times, barre and yoga without counting.',
    allowances: [
      { types: ['reformer'], limit: 12, per: 'month' },
      { types: ['barre', 'yoga'], limit: null, per: 'month' }
    ]
  },
  {
    id: 'unlimited', name: 'Unlimited', price: 24900,
    blurb: 'Everything on the mat and the carriage, as often as you like.',
    allowances: [ { types: ['reformer', 'barre', 'yoga'], limit: null, per: 'month' } ]
  },
  {
    id: 'wellness', name: 'Wellness', price: 28900,
    blurb: 'Signature, and a treatment room to disappear into once a month.',
    allowances: [
      { types: ['reformer'], limit: 12, per: 'month' },
      { types: ['barre', 'yoga'], limit: null, per: 'month' },
      { types: ['massage'], limit: 1, per: 'month' }
    ]
  }
];

export const ADMIN_CODE = 'DUA-2026-STUDIO';   // never rendered; checked at registration

/* ---------- dates ---------- */
export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function startOfWeek(d) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
export function minutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
export function at(dateStr, hhmm) { return new Date(dateStr + 'T' + hhmm + ':00'); }

/* ---------- seed ---------- */
const today = new Date(); today.setHours(0, 0, 0, 0);
const monday = startOfWeek(today);
const day = n => iso(addDays(monday, n));

const band = (from, to) => ({ from, to });

export function seed() {
  const instructors = [
    { id: 'i-elira', name: 'Elira Hoxha', email: 'elira@dua-pilates.com', phone: '069 710 4073',
      qualifications: ['reformer', 'barre'], active: true, password: 'demo1234',
      availability: { mon: [band('09:00','20:00')], tue: [band('09:00','20:00')], wed: [band('12:00','18:00')],
                      thu: [band('09:00','20:00')], fri: [band('09:00','17:00')], sat: [], sun: [] } },
    { id: 'i-ana', name: 'Ana Leka', email: 'ana@dua-pilates.com', phone: '069 710 4074',
      qualifications: ['reformer', 'yoga'], active: true, password: 'demo1234',
      availability: { mon: [band('13:00','19:00')], tue: [band('13:00','19:00')], wed: [band('08:00','19:00')],
                      thu: [band('13:00','19:00')], fri: [band('13:00','19:00')], sat: [band('09:00','14:00')], sun: [] } },
    { id: 'i-era', name: 'Era Meta', email: 'era@dua-pilates.com', phone: '069 710 4075',
      qualifications: ['yoga', 'barre'], active: true, password: 'demo1234',
      availability: { mon: [band('11:00','15:00')], tue: [band('11:00','15:00')], wed: [band('11:00','15:00')],
                      thu: [band('11:00','15:00')], fri: [band('11:00','15:00')], sat: [], sun: [band('10:00','14:00')] } },
    { id: 'i-jona', name: 'Jona Rexha', email: 'jona@dua-pilates.com', phone: '069 710 4076',
      qualifications: ['massage'], active: true, password: 'demo1234',
      availability: { mon: [band('10:00','18:00')], tue: [band('10:00','18:00')], wed: [band('10:00','18:00')],
                      thu: [band('10:00','18:00')], fri: [band('10:00','18:00')], sat: [], sun: [] } }
  ];

  /* A week that looks like a real timetable: mornings, a lunch slot,
     and the evening block that always fills first. */
  const template = [
    [0, 'reformer', '09:00', '10:00', 10, 'i-elira'],
    [0, 'barre',    '11:00', '12:00', 12, 'i-era'  ],
    [0, 'yoga',     '12:00', '13:00', 15, 'i-era'  ],
    [0, 'reformer', '16:00', '17:00', 10, 'i-elira'],
    [0, 'reformer', '18:00', '19:00', 10, 'i-ana'  ],
    [1, 'reformer', '09:00', '10:00', 10, 'i-elira'],
    [1, 'yoga',     '12:00', '13:00', 15, 'i-era'  ],
    [1, 'reformer', '18:00', '19:00', 10, 'i-ana'  ],
    [2, 'reformer', '09:00', '10:00', 10, 'i-ana'  ],
    [2, 'barre',    '13:00', '14:00', 12, 'i-era'  ],
    [2, 'reformer', '17:00', '18:00', 10, 'i-elira'],
    [3, 'reformer', '09:00', '10:00', 10, 'i-elira'],
    [3, 'yoga',     '12:00', '13:00', 15, 'i-era'  ],
    [3, 'reformer', '18:00', '19:00', 10, 'i-ana'  ],
    [4, 'reformer', '09:00', '10:00', 10, 'i-elira'],
    [4, 'barre',    '11:00', '12:00', 12, 'i-era'  ],
    [4, 'reformer', '16:00', '17:00', 10, 'i-elira'],
    [5, 'reformer', '10:00', '11:00', 10, 'i-ana'  ],
    [5, 'yoga',     '11:30', '12:30', 15, 'i-ana'  ],
    [6, 'yoga',     '11:00', '12:00', 15, 'i-era'  ]
  ];

  const sessions = [];
  for (let w = -1; w <= 2; w++) {
    template.forEach(([d, typeId, start, end, capacity, instructorId], k) => {
      sessions.push({
        id: 's' + w + '-' + d + '-' + k, typeId, date: day(d + w * 7),
        start, end, capacity, instructorId, cancelled: false
      });
    });
  }
  /* Ana's Saturday ends at 14:00. This class was set before that and is
     exactly the drift the admin's attention list exists to surface. */
  sessions.push({ id: 'drift', typeId: 'reformer', date: day(12), start: '16:00', end: '17:00',
                  capacity: 10, instructorId: 'i-ana', cancelled: false });

  /* Massage runs by appointment rather than on the timetable. */
  [1, 3].forEach(d => sessions.push({
    id: 'm-' + d, typeId: 'massage', date: day(d), start: '15:00', end: '16:00',
    capacity: 1, instructorId: 'i-jona', cancelled: false
  }));

  const clients = [
    { id: 'c-sara',  name: 'Sara Berberi',    email: 'sara@example.com',  phone: '069 200 1001', password: 'demo1234' },
    { id: 'c-enke',  name: 'Enkelejda Gjoka', email: 'enke@example.com',  phone: '069 200 1002', password: 'demo1234' },
    { id: 'c-kejsi', name: 'Kejsi Dervishi',  email: 'kejsi@example.com', phone: '069 200 1003', password: 'demo1234' },
    { id: 'c-ana',   name: 'Ana Përmeti',     email: 'anap@example.com',  phone: '069 200 1004', password: 'demo1234' }
  ];

  const first = iso(addDays(today, -12));
  const memberships = [
    { id: 'mem-1', clientId: 'c-sara',  planId: 'signature', start: first, end: iso(addDays(today, 18)), status: 'active' },
    { id: 'mem-2', clientId: 'c-enke',  planId: 'essential', start: first, end: iso(addDays(today, 18)), status: 'active' },
    { id: 'mem-3', clientId: 'c-kejsi', planId: 'unlimited', start: first, end: iso(addDays(today, 18)), status: 'active' },
    { id: 'mem-4', clientId: 'c-ana',   planId: 'essential', start: iso(addDays(today, -45)), end: iso(addDays(today, -15)), status: 'expired' }
  ];

  /* Enough history that the dashboards have something to count. */
  const bookings = [];
  let n = 0;
  const book = (clientId, sessionId, status) =>
    bookings.push({ id: 'b' + (++n), clientId, sessionId, status: status || 'booked', at: iso(today) });

  sessions.filter(s => s.date < iso(today) && s.typeId !== 'massage').forEach((s, k) => {
    if (k % 3 === 0) book('c-sara', s.id);
    if (k % 4 === 0) book('c-enke', s.id);
    if (k % 2 === 0) book('c-kejsi', s.id);
  });
  sessions.filter(s => s.date >= iso(today) && s.date <= iso(addDays(today, 6))).forEach((s, k) => {
    if (s.typeId === 'massage') return;
    const fill = (k * 7) % 9;                       // a believable spread of demand
    for (let i = 0; i < fill && i < s.capacity; i++) bookings.push({
      id: 'b' + (++n), clientId: 'ghost-' + s.id + '-' + i, sessionId: s.id, status: 'booked', at: iso(today)
    });
  });
  /* The evening reformer always goes first. */
  const hot = sessions.find(s => s.date === iso(today) && s.start === '18:00');
  if (hot) while (bookings.filter(b => b.sessionId === hot.id && b.status === 'booked').length < hot.capacity)
    bookings.push({ id: 'b' + (++n), clientId: 'ghost-full-' + n, sessionId: hot.id, status: 'booked', at: iso(today) });

  return {
    instructors, sessions, clients, memberships, bookings,
    admins: [{ id: 'a-1', name: 'Studio Admin', email: 'admin@dua-pilates.com', phone: '069 710 4072', password: 'demo1234' }],
    session: null
  };
}
