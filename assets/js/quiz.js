/* ============================================================
   DUA — which package is yours
   ------------------------------------------------------------
   Twenty-two things to choose between is a lot to read, so this asks
   three or four questions and names one. It decides nothing the page
   does not already say: every answer points at a card that is on this
   page, and the result opens its tab, scrolls to it and marks it.

   Nothing is stored and nothing is sent. The answers live in one array
   for as long as the tab is open.
   ============================================================ */
(function () {
  'use strict';
  var root = document.getElementById('quiz');
  if (!root) return;

  /* ---------- the questions ----------
     Each step is a question and its answers; an answer either names the
     next step or ends it. Written in English and translated on the way
     into the page, like the rest of the site. */
  var STEPS = {
    start: { q: 'What are you here for?', a: [
      { t: 'Reformer Pilates', v: 'reformer', go: 'r_done' },
      { t: 'Massage and spa', v: 'spa', go: 's_goal' },
      { t: 'Both', v: 'both', go: 'b_often' }
    ]},

    /* reformer */
    r_done: { q: 'Have you been on a reformer before?', a: [
      { t: 'Never', v: 'new', go: 'r_often' },
      { t: 'A few times', v: 'some', go: 'r_often' },
      { t: 'Yes, regularly', v: 'regular', go: 'r_often' }
    ]},
    r_often: { q: 'How often would you like to come?', a: [
      { t: 'Just once, to see', v: 'once', go: null },
      { t: 'About once a week', v: 'w1', go: 'r_who' },
      { t: 'Twice a week', v: 'w2', go: 'r_who' },
      { t: 'Three or four times a week', v: 'w3', go: 'r_who' }
    ]},
    r_who: { q: 'In a small group, or one to one?', a: [
      { t: 'A small group', v: 'group', go: null },
      { t: 'One to one', v: 'solo', go: null },
      { t: 'Either is fine', v: 'group', go: null }
    ]},

    /* spa */
    s_goal: { q: 'What would you like it to do?', a: [
      { t: 'Switch everything off', v: 'relax', go: 's_many' },
      { t: 'Make me feel lighter', v: 'light', go: 's_many' },
      { t: 'Work on firming', v: 'firm', go: 's_many' },
      { t: 'Ease aching muscles', v: 'ache', go: 's_many' }
    ]},
    s_many: { q: 'One treatment, or a few?', a: [
      { t: 'Just one', v: 'one', go: 's_long' },
      { t: 'A few, over time', v: 'many', go: null }
    ]},
    s_long: { q: 'How long?', a: [
      { t: 'An hour', v: 'h1', go: null },
      { t: 'The full ninety minutes', v: 'h15', go: null }
    ]},

    /* both */
    b_often: { q: 'How often on the reformer?', a: [
      { t: 'Once a week', v: 'w1', go: 'b_spa' },
      { t: 'Twice a week', v: 'w2', go: 'b_spa' },
      { t: 'Three times a week', v: 'w3', go: 'b_spa' },
      { t: 'Just once — a treat', v: 'treat', go: 'b_who' }
    ]},
    b_spa: { q: 'And what should the massage do?', a: [
      { t: 'Relax me', v: 'relax', go: 'b_who' },
      { t: 'Leave me lighter', v: 'light', go: 'b_who' },
      { t: 'Work on firming', v: 'firm', go: 'b_who' }
    ]},
    b_who: { q: 'Just you, or two of you?', a: [
      { t: 'Just me', v: 'me', go: null },
      { t: 'Two of us', v: 'two', go: null }
    ]}
  };

  /* ---------- what each answer adds up to ----------
     name is the card's data-pack; why is the one line that says the
     reason, so nobody has to take the answer on trust. */
  function decide(a) {
    var kind = a.start;

    if (kind === 'reformer') {
      if (a.r_who === 'solo')
        return { pack: 'personal', why: 'One to one, so the whole class is built around you.' };
      if (a.r_often === 'once')
        return a.r_done === 'new'
          ? { pack: 'try-dua', why: 'A first class, at the price we keep for a first class.' }
          : { pack: 'single', why: 'One class, no package, whenever it suits you.' };
      if (a.r_often === 'w1') return { pack: 'start', why: 'Four classes a month is about once a week.' };
      if (a.r_often === 'w2') return { pack: 'routine', why: 'Eight classes a month is about twice a week — and the best price per class for that rhythm.' };
      return a.r_done === 'regular'
        ? { pack: 'obsessed', why: 'Sixteen classes a month, and the lowest price per class we have.' }
        : { pack: 'glow', why: 'Twelve classes a month is about three times a week — room to build without overcommitting.' };
    }

    if (kind === 'spa') {
      if (a.s_many === 'many') {
        if (a.s_goal === 'light') return { pack: 'lymph-pack', why: 'Five lymphatic treatments, which is where this one works best.' };
        if (a.s_goal === 'firm') return { pack: 'sculpt-pack', why: 'Five sculpt treatments — body care asks for repetition.' };
        if (a.s_goal === 'ache') return { pack: 'deep', why: 'Deep recovery is not sold as a pack yet, so this is the treatment on its own.' };
        return { pack: 'relax-pack', why: 'Three relax treatments, at less than three separate ones.' };
      }
      if (a.s_long === 'h15') return { pack: 'signature', why: 'Ninety minutes, and the one we built to be the whole experience.' };
      if (a.s_goal === 'light') return { pack: 'lymph', why: 'Lymphatic massage, for lightness and recovery.' };
      if (a.s_goal === 'firm') return { pack: 'sculpt', why: 'Sculpt, for firming and body care.' };
      if (a.s_goal === 'ache') return { pack: 'deep', why: 'A deeper massage, for muscular tension.' };
      return { pack: 'relax', why: 'An hour that asks nothing of you.' };
    }

    /* both */
    if (a.b_who === 'two') return { pack: 'duo', why: 'Two of you, one price — a class and a massage each.' };
    if (a.b_often === 'treat') return { pack: 'weekend', why: 'One class and one massage. A weekend, or a gift.' };
    if (a.b_often === 'w1') return { pack: 'reset', why: 'Four classes and a massage — enough to start both at once.' };
    if (a.b_often === 'w3')
      return a.b_spa === 'light'
        ? { pack: 'light-lean', why: 'Twelve classes and four lymphatic treatments, which is the most movement with recovery behind it.' }
        : { pack: 'sculpt-combo', why: 'Eight classes and four sculpt treatments, for body care alongside the work.' };
    if (a.b_spa === 'light') return { pack: 'balance', why: 'Eight classes and two lymphatic treatments — movement and recovery in step.' };
    if (a.b_spa === 'firm') return { pack: 'sculpt-combo', why: 'Eight classes and four sculpt treatments, for body care alongside the work.' };
    return { pack: 'routine-relax', why: 'Eight classes and two massages — the one most people settle on.' };
  }

  /* ---------- the screen ---------- */
  var answers = {}, trail = [], step = 'start';
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function draw() {
    root.innerHTML = '';
    var s = STEPS[step];
    var done = trail.length, total = done + depth(step);

    var bar = el('p', 'quiz__step', 'Question ' + (done + 1) + ' of ' + total);
    var q = el('h3', 'quiz__q', s.q);
    var list = el('div', 'quiz__answers');

    s.a.forEach(function (ans) {
      var b = el('button', 'quiz__a', ans.t);
      b.type = 'button';
      b.addEventListener('click', function () {
        answers[step] = ans.v;
        trail.push(step);
        if (ans.go) { step = ans.go; draw(); }
        else result();
      });
      list.appendChild(b);
    });

    root.appendChild(bar);
    root.appendChild(q);
    root.appendChild(list);
    if (trail.length) root.appendChild(back());
  }

  /* How many questions are still to come on the longest road from here,
     so the counter can say "2 of 4" without pretending to know more. */
  function depth(from) {
    var s = STEPS[from];
    if (!s) return 0;
    var most = 0;
    s.a.forEach(function (a) { if (a.go) most = Math.max(most, depth(a.go)); });
    return most + 1;
  }

  function back() {
    var b = el('button', 'quiz__back', 'Back');
    b.type = 'button';
    b.addEventListener('click', function () {
      step = trail.pop();
      delete answers[step];
      draw();
    });
    return b;
  }

  function result() {
    var r = decide(answers);
    var card = document.querySelector('[data-pack="' + r.pack + '"]');
    var name = card ? (card.querySelector('h3') || {}).textContent : null;

    root.innerHTML = '';
    root.appendChild(el('p', 'quiz__step', 'Yours'));
    root.appendChild(el('h3', 'quiz__name', (name || '').trim()));
    root.appendChild(el('p', 'quiz__why', r.why));

    var row = el('div', 'quiz__row');
    if (card) {
      var see = el('button', 'quiz__a quiz__a--go', 'Show me');
      see.type = 'button';
      see.addEventListener('click', function () { reveal(card); });
      row.appendChild(see);
    }
    var again = el('button', 'quiz__back', 'Start again');
    again.type = 'button';
    again.addEventListener('click', function () { answers = {}; trail = []; step = 'start'; draw(); });
    row.appendChild(again);
    root.appendChild(row);
  }

  /* Open whichever tab the card lives in, go to it, and mark it — the
     answer is a thing on this page, not a thing the quiz made up. */
  function reveal(card) {
    var panel = card.closest('.panel');
    if (panel) {
      var tab = document.querySelector('[role="tab"][aria-controls="' + panel.id + '"]');
      if (tab) tab.click();
    }
    document.querySelectorAll('.is-picked').forEach(function (n) { n.classList.remove('is-picked'); });
    card.classList.add('is-picked');
    setTimeout(function () {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  draw();
})();
