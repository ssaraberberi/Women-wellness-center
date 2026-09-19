/* ============================================================
   DUA — WhatsApp
   The button appears once the hero is behind you, and the card opens itself
   once, at the memberships section, where intent is highest. Dismiss it and
   it stays dismissed for the session.
   ============================================================ */
(function () {
  'use strict';

  var PHONE = '355697104072';                 // 069 710 4072
  var GREETING = {
    sq: 'Përshëndetje! Dua të di më shumë për abonimet tuaja.',
    en: "Hello! I'd like to know more about your memberships."
  };

  var wrap = document.getElementById('whatsapp');
  var fab = document.getElementById('wa-fab');
  var card = document.getElementById('wa-card');
  var go = document.getElementById('wa-go');
  var hero = document.getElementById('hero');
  var plans = document.getElementById('memberships');
  if (!wrap || !fab || !card || !go) return;

  wrap.hidden = false;

  function href() {
    var lang = document.documentElement.lang === 'en' ? 'en' : 'sq';
    return 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(GREETING[lang]);
  }
  // Built at open and at click, so switching language mid-visit is picked up.
  function refresh() { go.setAttribute('href', href()); }
  refresh();

  var open = false;
  function setOpen(next) {
    open = next;
    if (next) { card.hidden = false; void card.offsetWidth; refresh(); }
    wrap.classList.toggle('is-open', next);
    fab.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      go.focus({ preventScroll: true });
    } else {
      window.setTimeout(function () { if (!open) card.hidden = true; }, 450);
    }
  }

  function dismissed() {
    try { return sessionStorage.getItem('dua-wa') === 'off'; } catch (e) { return false; }
  }
  function dismiss() {
    try { sessionStorage.setItem('dua-wa', 'off'); } catch (e) {}
  }

  fab.addEventListener('click', function () {
    if (open) { dismiss(); setOpen(false); } else { setOpen(true); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-wa-close]')) { dismiss(); setOpen(false); return; }
    if (!open) return;
    if (!e.target.closest('#whatsapp')) { setOpen(false); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) { dismiss(); setOpen(false); fab.focus({ preventScroll: true }); }
  });
  go.addEventListener('click', function () { refresh(); dismiss(); setOpen(false); });

  /* Show the button only once the hero is out of the way. */
  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(function (entries) {
      wrap.classList.toggle('is-on', !entries[0].isIntersecting);
      if (entries[0].isIntersecting && open) setOpen(false);
    }, { threshold: 0.12 }).observe(hero);
  } else {
    wrap.classList.add('is-on');
  }

  /* One unprompted opening, at the point someone is actually weighing it up. */
  if ('IntersectionObserver' in window && plans) {
    var once = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      once.disconnect();
      if (dismissed()) return;
      window.setTimeout(function () { if (!dismissed() && !open) setOpen(true); }, 900);
    }, { threshold: 0.35 });
    once.observe(plans);
  }
})();
