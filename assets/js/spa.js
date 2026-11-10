/* ============================================================
   DUA — the spa menu (/spa)
   ------------------------------------------------------------
   Built from the same catalogue as the memberships on the homepage
   (/api/public/packages): every treatment, duration and price here is
   one the studio entered and the booking page sells. Nothing about the
   menu is written in spa/index.html, so nothing there can go stale.

   Treatments are grouped by what they are, read off their own words
   (lymph…, sculpt…, everything else is massage), and the same treatment
   at two lengths becomes one entry with two lines. A treatment bought
   several at a time is a series and sits at the end.

   English goes into the page, like everywhere else on the site, and
   i18n.js translates it on the way in. The studio's own words are
   picked per language here, because the dictionary cannot know them.
   ============================================================ */
(function () {
  'use strict';

  var box = document.getElementById('spa-menu');
  if (!box || !window.fetch) return;

  var lang = function () { return document.documentElement.lang === 'en' ? 'en' : 'sq'; };
  function say(p, field) {
    var en = p.en || {};
    return (lang() === 'en' ? (en[field] || p[field]) : (p[field] || en[field])) || '';
  }
  var money = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' L'; };
  var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function spaCount(p) {
    var n = 0, reformer = false;
    (p.allowances || []).forEach(function (a) {
      (a.types || []).forEach(function (t) { if (t !== 'spa') reformer = true; });
      if ((a.types || []).indexOf('spa') >= 0) n += a.limit || 0;
    });
    return reformer ? 0 : n;      // a package with reformer in it is not a spa treatment
  }

  var words = function (p) { return [p.name, p.tagline, (p.en || {}).tagline].join(' ').toLowerCase(); };
  function category(p) {
    var w = words(p);
    if (/lymph|limf/.test(w)) return 'drainage';
    if (/sculpt|cellul|celul/.test(w)) return 'sculpt';
    return 'massage';
  }

  var CATS = {
    massage:  { title: 'Massage', line: 'From a short reset to the full ninety minutes.' },
    drainage: { title: 'Lymphatic drainage', line: 'A gentle, rhythmic manual technique with light, even pressure.' },
    sculpt:   { title: 'Body sculpting', line: 'Firm, focused massage for the body’s contours.' },
    series:   { title: 'Series', line: 'The same treatment, booked as a set.' }
  };

  /* A line for the treatments the studio offers today. Matched on her
     English, so a treatment she adds later simply arrives without one. */
  var NOTES = [
    [/relax \+ recovery/, 'Our longest treatment: a full relaxing massage with unhurried time for recovery.'],
    [/relaxing/, 'Slow, flowing strokes and an unhurried pace.'],
    [/deep tissue/, 'Firmer, focused pressure where muscles hold tension.'],
    [/neck/, 'Neck, shoulders, upper back and scalp, where long desk days collect.'],
    [/lymph/, 'Light, rhythmic movements, slow and precise throughout.'],
    [/sculpt|cellulite/, 'Firm, energetic strokes focused on the body’s contours.']
  ];
  function note(p) {
    var en = ((p.en || {}).tagline || '').toLowerCase();
    for (var i = 0; i < NOTES.length; i++) if (NOTES[i][0].test(en)) return NOTES[i][1];
    return '';
  }

  var minutes = function (p) { var m = /(\d+)\s*min/.exec(p.rhythm || p.name); return m ? Number(m[1]) : 0; };

  function option(p, label) {
    var row = el('div', 'svc__opt');
    row.appendChild(el('span', 'svc__dur', label));
    if (p.price != null) {
      var price = el('span', 'svc__price', money(p.price));
      price.setAttribute('data-price', '');
      row.appendChild(price);
    }
    var soon = el('span', 'svc__price', 'Price coming soon');
    soon.setAttribute('data-noprice', '');
    row.appendChild(soon);
    var go = el('a', 'go', 'Book');
    go.href = '/book?plan=' + encodeURIComponent(p.id);
    row.appendChild(go);
    return row;
  }

  var data = null;

  function draw() {
    box.innerHTML = '';
    var groups = { massage: {}, drainage: {}, sculpt: {}, series: [] };
    var order = { massage: [], drainage: [], sculpt: [] };

    data.packages.forEach(function (p) {
      var n = spaCount(p);
      if (!n) return;
      if (n > 1) { groups.series.push(p); return; }
      var c = category(p);
      var key = ((p.en || {}).tagline || p.tagline || p.name).toLowerCase();
      if (!groups[c][key]) { groups[c][key] = []; order[c].push(key); }
      groups[c][key].push(p);
    });

    ['massage', 'drainage', 'sculpt', 'series'].forEach(function (c) {
      var list = c === 'series' ? groups.series : order[c];
      if (!list.length) return;

      var sec = el('section', 'cat');
      sec.id = 'spa-' + c;
      var head = el('div', 'cat__head');
      head.appendChild(el('h3', null, CATS[c].title));
      head.appendChild(el('p', null, CATS[c].line));
      sec.appendChild(head);
      var body = el('div', 'cat__list');

      if (c === 'series') {
        list.forEach(function (p) {
          var svc = el('article', 'svc');
          svc.appendChild(el('h4', 'svc__name', p.name));
          var opts = el('div', 'svc__opts');
          opts.appendChild(option(p, say(p, 'tagline') || (spaCount(p) + ' treatments')));
          svc.appendChild(opts);
          body.appendChild(svc);
        });
        body.querySelectorAll('.svc__opt').forEach(function (r) { r.classList.add('svc__opt--wide'); });
      } else {
        list.forEach(function (key) {
          var items = groups[c][key].slice().sort(function (a, b) { return minutes(a) - minutes(b); });
          var first = items[0];
          var svc = el('article', 'svc');
          /* In Albanian her name for it is the part after "•" ("60 min •
             masazh i thellë"); her tagline is sometimes a description instead. */
          var named = lang() === 'sq' && first.name.indexOf('•') > 0 ? first.name.split('•')[1].trim() : '';
          svc.appendChild(el('h4', 'svc__name', cap(named || say(first, 'tagline') || first.name)));
          if (note(first)) svc.appendChild(el('p', 'svc__desc', note(first)));
          var opts = el('div', 'svc__opts');
          items.forEach(function (p) { opts.appendChild(option(p, p.rhythm || '')); });
          svc.appendChild(opts);
          body.appendChild(svc);
        });
      }
      sec.appendChild(body);

      /* The before-and-after belongs beside the treatment it shows. */
      if (c === 'sculpt') {
        var tpl = document.getElementById('ba-template');
        if (tpl && tpl.content) sec.appendChild(tpl.content.cloneNode(true));
      }
      box.appendChild(sec);
    });

    if (!box.children.length) box.appendChild(el('p', 'menu-empty', 'The menu will be here shortly. Message us and we will send it to you.'));
  }

  fetch('/api/public/packages', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.packages) throw new Error('no packages');
      data = d;
      if (d.showPrices === true) document.documentElement.classList.add('prices');
      draw();
      if (!window.MutationObserver) return;
      var was = lang();
      new MutationObserver(function () {
        if (lang() === was) return;
        was = lang();
        draw();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    })
    .catch(function () {
      box.innerHTML = '';
      box.appendChild(el('p', 'menu-empty', 'The menu will be here shortly. Message us and we will send it to you.'));
    });
})();
