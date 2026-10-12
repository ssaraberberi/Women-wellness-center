/* ============================================================
   DUA — the packages, as the studio enters them
   ------------------------------------------------------------
   Every package on this page comes from the studio's own database.
   There is no copy of the catalogue in index.html to fall out of step
   with it: the three panels ship empty, and this fills them.

   Which means the honest thing has to happen when there is nothing to
   fill them with. No packages, no JavaScript, no network, a slow answer
   or a broken one, and the section says the packages are coming — the
   same thing the timetable and the studio photographs already say —
   rather than showing a catalogue nobody can buy from.

   Everything this generates is written in English, because the page's
   own translator keys on the English source string and is watching for
   new nodes — so "classes" and "Price coming soon" come out Albanian
   without this file knowing a word of it. What it cannot translate is
   what the studio typed, so each text has an optional English version
   and falls back to the other one when it is blank.

   Prices are the server's business: while the switch is off they are
   not in the answer at all, and the card says the price is coming.
   ============================================================ */
(function () {
  var section = document.getElementById('memberships');
  if (!section || !window.fetch) return;

  var PANELS = { pilates: 'panel-pilates', spa: 'panel-spa', combo: 'panel-combo' };
  var data = null;

  fetch('/api/public/packages', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.packages || !d.packages.length) return;   // the section stays as it is: coming soon
      data = d;
      build();
      watchLanguage();
      /* The tabs and the quiz are wired before this answer arrives, so
         they are told when there is finally something to work with. */
      document.dispatchEvent(new CustomEvent('dua:packages'));
    })
    .catch(function () {});

  /* ---------- reading a package ---------- */

  var lang = function () { return document.documentElement.lang === 'en' ? 'en' : 'sq'; };
  /* Her text, in the language being read, falling back to the one she
     actually filled in. Never an empty card because a field was blank. */
  function say(p, field) {
    var en = p.en || {};
    return (lang() === 'en' ? (en[field] || p[field]) : (p[field] || en[field])) || '';
  }

  var countOf = function (p, type) {
    var n = 0, unlimited = false;
    (p.allowances || []).forEach(function (a) {
      if ((a.types || []).indexOf(type) < 0) return;
      if (a.limit == null) unlimited = true; else n += a.limit;
    });
    return unlimited ? null : n;
  };

  /* Which tab it belongs in is read off what it allows, not off a field
     somebody has to remember to set. */
  function kindOf(p) {
    var r = false, s = false;
    (p.allowances || []).forEach(function (a) {
      (a.types || []).forEach(function (t) { if (t === 'spa') s = true; else r = true; });
    });
    return r && s ? 'combo' : s ? 'spa' : 'pilates';
  }

  var money = function (n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' L';
  };

  /* What the quiz needs to find a card when the one it had in mind is
     not on the page: the shape of the package, rather than its name. */
  function tag(card, p) {
    card.setAttribute('data-kind', kindOf(p));
    card.setAttribute('data-classes', String(countOf(p, 'reformer') || 0));
    card.setAttribute('data-spa', String(countOf(p, 'spa') || 0));
  }

  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ---------- the three shapes of card ---------- */

  function priceLines(p, each) {
    var out = [];
    if (p.price != null) {
      var price = el('p', 'pack__price', money(p.price));
      price.setAttribute('data-price', '');
      out.push(price);
      if (each) {
        var per = el('p', 'pack__each', money(each) + ' / class');
        per.setAttribute('data-price', '');
        out.push(per);
      }
    }
    var soon = el('p', 'pack__soon', 'Price coming soon');
    soon.setAttribute('data-noprice', '');
    out.push(soon);
    return out;
  }

  function packCard(p, step) {
    var card = el('article', 'pack' + (p.featured ? ' pack--feature' : ''));
    card.setAttribute('data-pack', p.id);
    card.setAttribute('data-reveal', '');
    card.classList.add('is-in');
    tag(card, p);
    card.style.setProperty('--step', String(step));
    if (p.featured) card.appendChild(el('span', 'pack__flag', 'Most popular'));
    card.appendChild(el('h3', 'pack__name', p.name));

    var n = countOf(p, 'reformer');
    var count = el('p', 'pack__count');
    count.appendChild(el('b', null, n == null ? '∞' : String(n)));
    count.appendChild(document.createTextNode(' '));
    count.appendChild(el('span', null, n === 1 ? 'class' : 'classes'));
    card.appendChild(count);

    var bar = el('span', 'pack__bar');
    bar.setAttribute('aria-hidden', 'true');
    bar.appendChild(el('i'));
    card.appendChild(bar);

    if (say(p, 'tagline')) card.appendChild(el('p', 'pack__sub', say(p, 'tagline')));
    if (say(p, 'rhythm')) card.appendChild(el('p', 'pack__rhythm', say(p, 'rhythm')));
    priceLines(p, n && n > 1 && p.price != null ? Math.round(p.price / n) : 0)
      .forEach(function (node) { card.appendChild(node); });
    if (say(p, 'blurb')) card.appendChild(el('p', 'pack__note', say(p, 'blurb')));
    return card;
  }

  function treatCard(p) {
    var card = el('article', 'treat');
    card.setAttribute('data-pack', p.id);
    card.setAttribute('data-reveal', '');
    card.classList.add('is-in');
    tag(card, p);
    card.appendChild(el('h3', 'treat__name', p.name));
    if (say(p, 'tagline')) card.appendChild(el('p', 'treat__sub', say(p, 'tagline')));

    var n = countOf(p, 'spa');
    var side = say(p, 'rhythm') || (n > 1 ? n + ' treatments' : '');
    if (p.price != null) {
      var price = el('p', 'treat__price', money(p.price) + ' ');
      price.setAttribute('data-price', '');
      if (side) price.appendChild(el('span', null, '· ' + side));
      card.appendChild(price);
    }
    var soon = el('p', 'treat__soon', 'Price coming soon ');
    soon.setAttribute('data-noprice', '');
    if (side) soon.appendChild(el('span', null, '· ' + side));
    card.appendChild(soon);

    if (say(p, 'blurb')) {
      var list = el('ul', 'treat__list');
      list.appendChild(el('li', null, say(p, 'blurb')));
      card.appendChild(list);
    }
    return card;
  }

  function comboCard(p) {
    var card = el('article', 'combo' + (p.featured ? ' combo--feature' : ''));
    card.setAttribute('data-pack', p.id);
    card.setAttribute('data-reveal', '');
    card.classList.add('is-in');
    tag(card, p);
    if (p.featured) card.appendChild(el('span', 'combo__flag', 'Our main package'));
    card.appendChild(el('h3', 'combo__name', p.name));

    /* The factual line, built from what it allows: nothing to keep in
       step by hand, and nothing that can disagree with the booking. */
    var r = countOf(p, 'reformer'), s = countOf(p, 'spa');
    var what = [];
    if (r) what.push(r + ' Pilates');
    if (s) what.push(s + ' Spa');
    card.appendChild(el('p', 'combo__what', what.join(' + ')));

    if (p.price != null) {
      var price = el('p', 'combo__price', money(p.price));
      price.setAttribute('data-price', '');
      card.appendChild(price);
    }
    var soon = el('p', 'combo__soon', 'Price coming soon');
    soon.setAttribute('data-noprice', '');
    card.appendChild(soon);

    if (say(p, 'tagline')) card.appendChild(el('p', 'combo__value', say(p, 'tagline')));
    if (say(p, 'blurb')) card.appendChild(el('p', 'combo__note', say(p, 'blurb')));
    return card;
  }

  /* ---------- putting them on the page ---------- */

  var show = function (node, on) { if (node) node.hidden = !on; };

  function build() {
    var groups = { pilates: [], spa: [], combo: [] };
    data.packages.forEach(function (p) { groups[kindOf(p)].push(p); });

    /* There is something to show, so the section stops saying there is
       not: the tabs come back, the line goes, and the offers — which are
       conditions on a package — come with them. */
    show(document.querySelector('.tabs[role="tablist"]'), true);
    show(document.querySelector('.offers'), true);
    show(document.getElementById('which'), true);
    var soon = document.getElementById('plans-soon');
    if (soon) soon.remove();

    Object.keys(PANELS).forEach(function (kind) {
      var panel = document.getElementById(PANELS[kind]);
      if (!panel) return;
      var tab = document.querySelector('[role="tab"][aria-controls="' + PANELS[kind] + '"]');
      var list = groups[kind];

      /* A tab with nothing behind it is not a tab. */
      if (!list.length) {
        panel.hidden = true;
        if (tab) tab.hidden = true;
        panel.innerHTML = '';
        return;
      }
      if (tab) tab.hidden = false;

      /* The panel's own introduction is the page's prose, not package
         data, so it stays; everything else was a package and goes. */
      var lede = panel.querySelector('.panel__lede');
      panel.innerHTML = '';
      if (lede) panel.appendChild(lede);

      var grid = el('div', kind === 'pilates' ? 'packs' : kind === 'spa' ? 'treats' : 'combos');
      if (kind === 'pilates') {
        /* The ladder: the rule under each number grows with the package,
           so the progression is visible before a word is read. */
        var most = 1;
        list.forEach(function (p) { most = Math.max(most, countOf(p, 'reformer') || 1); });
        list.forEach(function (p) {
          grid.appendChild(packCard(p, Math.max(0.2, Math.min(1, (countOf(p, 'reformer') || 1) / most)).toFixed(3)));
        });
      } else {
        list.forEach(function (p) { grid.appendChild((kind === 'spa' ? treatCard : comboCard)(p)); });
      }
      panel.appendChild(grid);
    });

    /* Whichever tab is first with something behind it is the one that
       opens — the panels arrived hidden and nothing else would open one. */
    var open = document.querySelector('.tab.is-on:not([hidden])');
    var first = open || document.querySelector('.tab:not([hidden])');
    if (first) first.click();
  }

  /* Her own words are the one thing the page's translator cannot do, so
     they are rebuilt when the language changes. */
  function watchLanguage() {
    if (!window.MutationObserver) return;
    var was = lang();
    new MutationObserver(function () {
      if (lang() === was) return;
      was = lang();
      build();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
})();
