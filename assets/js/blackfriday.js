/* ============================================================
   DUA — Black Friday offer on the homepage
   ------------------------------------------------------------
   The offer lives in the studio's system (an offer called BLACK FRIDAY
   with a limit of 10). This reads it from the public catalogue and, while
   it has places left, shows it three ways:
     · the big section after the hero (#black-friday)
     · a red bar at the bottom of the screen (closable, per visit)
     · a pop-up, once per browser
   "Only 7 of 10 places left" is the real count: every sale at the desk
   lowers it, and at zero the offer leaves the catalogue and all of this
   stays hidden. Nothing here can sell or book: the button goes to /book.
   ============================================================ */
(function () {
  'use strict';

  var API = 'https://api-prod-production-19a0.up.railway.app';
  var TITLE = 'BLACK FRIDAY';
  var MAX = 10;
  var section = document.querySelector('[data-bf]');
  if (!section || !window.fetch) return;

  var store = {
    get: function (k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set: function (k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) { } }
  };
  var money = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ALL'; };
  var el = function (tag, cls, attrs, kids) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  };

  fetch(API + '/public/catalogue', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var o = d && (d.offers || []).filter(function (x) { return (x.title || '').toUpperCase() === TITLE; })[0];
      if (!o || o.left === 0 || !o.product) return;
      show(o);
    })
    .catch(function () { });

  function show(o) {
    var p = o.product;
    var left = o.left == null ? MAX : Math.max(0, Math.min(MAX, o.left));

    /* ---- the section ---- */
    var set = function (sel, text) { var n = section.querySelector(sel); if (n) n.textContent = text; };
    set('[data-bf-credits]', p.classCredits);
    set('[data-bf-months]', Math.round(p.validityDays / 30));
    set('[data-bf-price]', money(p.price));
    if (p.originalPrice) set('[data-bf-was]', money(p.originalPrice)); else section.querySelector('[data-bf-was]').remove();
    set('[data-bf-left]', left);
    var pips = section.querySelector('[data-bf-pips]');
    for (var i = 0; i < MAX; i++) pips.appendChild(el('i', i < MAX - left ? 'is-taken' : null));
    section.hidden = false;
    document.documentElement.classList.add('has-bf');

    /* ---- the bar at the bottom ---- */
    if (store.get('dua-bf-bar', true) !== 'closed') {
      var bar = el('div', 'bf-bar', { role: 'region', 'aria-label': 'Black Friday' }, [
        el('a', 'bf-bar__link', { href: '#black-friday' }, [
          el('b', null, { 'data-sq': 'Black Friday' }, ['Black Friday']),
          el('span', 'bf-bar__deal', {}, [p.classCredits + ' ', el('span', null, { 'data-sq': 'seanca' }, ['classes']), ' · ' + money(p.price)]),
          el('span', 'bf-bar__left', {}, [el('span', null, { 'data-sq': 'Mbeten' }, ['Only']), ' ', el('b', null, {}, [String(left)]), ' ', el('span', null, { 'data-sq': 'nga 10 vende' }, ['of 10 places left'])])
        ]),
        el('button', 'bf-bar__x', { type: 'button', 'aria-label': 'Close' }, ['×'])
      ]);
      bar.querySelector('.bf-bar__x').addEventListener('click', function () {
        bar.remove();
        document.documentElement.classList.remove('has-bf-bar');
        store.set('dua-bf-bar', 'closed', true);
      });
      // Out of the way while the offer itself is on screen.
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (es) { bar.classList.toggle('is-away', es[0].isIntersecting); }, { threshold: 0.15 }).observe(section);
      }
      document.body.appendChild(bar);
      document.documentElement.classList.add('has-bf-bar');
    }

    /* ---- the pop-up, once per browser ---- */
    if (store.get('dua-bf-seen') || typeof HTMLDialogElement === 'undefined') return;
    setTimeout(function () {
      if (document.querySelector('dialog[open]') || document.body.classList.contains('is-modal')) return;
      store.set('dua-bf-seen', '1');
      var dlg = el('dialog', 'bf-pop', { 'aria-labelledby': 'bf-pop-title' }, [
        el('button', 'bf-pop__x', { type: 'button', 'aria-label': 'Close' }, ['×']),
        el('p', 'bf-pop__kicker', {}, ['DUA Pilates & Spa']),
        el('h2', 'bf-pop__title', { id: 'bf-pop-title' }, [el('span', null, { 'data-sq': 'Black' }, ['Black']), ' ', el('em', null, { 'data-sq': 'Friday' }, ['Friday'])]),
        el('p', 'bf__tag', { 'data-sq': 'Vetëm për 10 vajza' }, ['For 10 women only']),
        el('p', 'bf-pop__deal', {}, [
          el('span', null, { 'data-sq': '2× në javë' }, ['2× a week']), ' · ' + p.classCredits + ' ',
          el('span', null, { 'data-sq': 'seanca' }, ['classes'])
        ]),
        el('p', 'bf-pop__price', {}, [p.originalPrice ? el('s', null, {}, [money(p.originalPrice)]) : '', ' ', el('strong', null, {}, [money(p.price)])]),
        el('p', 'bf-pop__left', {}, [el('span', null, { 'data-sq': 'Mbeten' }, ['Only']), ' ', el('b', null, {}, [String(left)]), ' ', el('span', null, { 'data-sq': 'nga 10 vende' }, ['of 10 places left'])]),
        el('div', 'bf-pop__actions', {}, [
          el('a', 'btn bf__cta', { href: '/book', 'data-sq': 'Rezervo tani' }, ['Book now']),
          el('a', 'link link--light', { href: '#black-friday', 'data-sq': 'Shiko ofertën' }, ['See the offer'])
        ])
      ]);
      var close = function () { dlg.close(); };
      dlg.addEventListener('close', function () { dlg.remove(); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.bf-pop__x') || e.target.closest('a[href^="#"]')) close(); });
      document.body.appendChild(dlg);
      dlg.showModal();
    }, 2500);
  }
})();
