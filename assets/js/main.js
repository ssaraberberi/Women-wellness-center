/* ============================================================
   Beci — interaction layer
   Vanilla JS. No dependencies. Motion is opt-out aware.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 900px)');
  var motionOK = function () { return !reduce.matches; };

  var vh = window.innerHeight;
  var vw = window.innerWidth;

  /* ---------------------------------------------------------
     1. Intro curtain
     --------------------------------------------------------- */
  (function intro() {
    var el = document.getElementById('intro');
    if (!el) return;
    var open = function () {
      el.classList.add('is-gone');
      root.classList.add('is-ready');
      window.setTimeout(function () { el.remove(); }, 900);
    };
    if (!motionOK()) { el.remove(); root.classList.add('is-ready'); return; }
    // Never hold the page hostage: hard cap regardless of asset loading.
    var t = window.setTimeout(open, 1500);
    window.addEventListener('load', function () {
      window.clearTimeout(t);
      window.setTimeout(open, 420);
    });
  })();

  /* ---------------------------------------------------------
     2. Reveals
     --------------------------------------------------------- */
  var sweepReveals = function () {};
  (function reveals() {
    var items = document.querySelectorAll('[data-reveal], [data-reveal-lines], [data-reveal-img]');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add('is-in'); });
      return;
    }
    var pending = Array.prototype.slice.call(items);

    function show(el, stagger) {
      if (stagger) {
        // Stagger siblings that share a parent so lists breathe in sequence.
        var sibs = el.parentNode ? el.parentNode.querySelectorAll(':scope > [data-reveal]') : [];
        var i = Array.prototype.indexOf.call(sibs, el);
        if (i > 0) el.style.transitionDelay = Math.min(i * 0.08, 0.4) + 's';
      }
      el.classList.add('is-in');
      io.unobserve(el);
      var at = pending.indexOf(el);
      if (at > -1) pending.splice(at, 1);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) show(e.target, true); });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    pending.forEach(function (el) { io.observe(el); });

    // A fast scroll or an anchor jump can carry an element past the viewport
    // between observer callbacks — it would then stay invisible forever.
    // Sweep the stragglers, cheaply and rarely.
    var lastSweep = 0;
    sweepReveals = function (now) {
      if (!pending.length || now - lastSweep < 400) return;
      lastSweep = now;
      for (var i = pending.length - 1; i >= 0; i--) {
        if (pending[i].getBoundingClientRect().top < window.innerHeight * 0.92) show(pending[i], false);
      }
    };
  })();

  /* ---------------------------------------------------------
     3. Navigation state
     --------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var hero = document.getElementById('hero');

  function navState(y) {
    if (!nav) return;
    nav.classList.toggle('is-stuck', y > 40);
    var lightUntil = hero ? hero.offsetHeight - 90 : 0;
    nav.classList.toggle('is-light', y < lightUntil && !document.body.classList.contains('is-menu'));
  }

  /* ---------------------------------------------------------
     4. Mobile menu
     --------------------------------------------------------- */
  (function menu() {
    var burger = document.getElementById('burger');
    var panel = document.getElementById('menu');
    if (!burger || !panel) return;

    function close() {
      panel.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('is-menu');
      window.setTimeout(function () {
        if (!panel.classList.contains('is-open')) panel.hidden = true;
      }, 560);
      navState(window.scrollY);
    }
    function open() {
      panel.hidden = false;
      // force reflow so the transition runs from the hidden state
      void panel.offsetWidth;
      panel.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('is-menu');
      nav.classList.remove('is-light');
    }
    burger.addEventListener('click', function () {
      panel.classList.contains('is-open') ? close() : open();
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 980 && panel.classList.contains('is-open')) close();
    });
  })();

  /* ---------------------------------------------------------
     5. Scroll-driven motion
     --------------------------------------------------------- */
  var parallax = Array.prototype.map.call(document.querySelectorAll('[data-parallax]'), function (el) {
    return { el: el, k: parseFloat(el.getAttribute('data-parallax')) || 0.15, top: 0, h: 0 };
  });
  var marquees = Array.prototype.map.call(document.querySelectorAll('[data-marquee], [data-xtype]'), function (el) {
    var attr = el.getAttribute('data-xtype');
    return {
      el: el,
      speed: attr ? parseFloat(attr) : -90,   // px of travel per 1000px scrolled
      base: el.hasAttribute('data-marquee') ? -60 : 0,
      w: 0
    };
  });
  var words = document.querySelectorAll('[data-words] .word');
  var hSection = document.querySelector('[data-h-section]');
  var hTrack = document.querySelector('[data-h-track]');
  var hIndex = document.querySelector('[data-h-index]');
  var hBar = document.querySelector('[data-h-bar]');
  var hMax = 0;

  function measure() {
    vh = window.innerHeight;
    vw = window.innerWidth;

    parallax.forEach(function (p) {
      var r = p.el.parentNode.getBoundingClientRect();
      p.top = r.top + window.scrollY;
      p.h = r.height;
    });
    marquees.forEach(function (m) { m.w = m.el.scrollWidth / 3; });

    if (hSection && hTrack) {
      var pin = desktop.matches && motionOK();
      hSection.classList.toggle('is-pinned', pin);
      if (pin) {
        hTrack.style.transform = '';
        hMax = Math.max(0, hTrack.scrollWidth - vw);
        hSection.style.setProperty('--h-height', (vh + hMax) + 'px');
      } else {
        hMax = 0;
        hSection.style.removeProperty('--h-height');
        hTrack.style.transform = '';
      }
    }
  }

  function frame() {
    var y = window.scrollY;
    navState(y);
    sweepReveals(Date.now());

    /* Hero + section background parallax: the image drifts slower than the page. */
    for (var i = 0; i < parallax.length; i++) {
      var p = parallax[i];
      var rel = y - p.top;
      if (rel < -vh || rel > p.h + vh) continue;
      p.el.style.transform = 'translate3d(0,' + (rel * p.k).toFixed(2) + 'px,0)';
    }

    /* Oversized type drifting horizontally against the scroll. */
    for (var j = 0; j < marquees.length; j++) {
      var m = marquees[j];
      if (!m.w) continue;
      var x = (m.base + (y / 1000) * m.speed) % m.w;
      if (x > 0) x -= m.w;
      m.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    }

    /* Sticky reformer image + the words passing it. */
    if (words.length) {
      var mid = vh * 0.5;
      var best = 0, bestD = Infinity;
      for (var k = 0; k < words.length; k++) {
        var r = words[k].getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = k; }
      }
      for (var n = 0; n < words.length; n++) {
        words[n].classList.toggle('is-active', n === best);
      }
    }

    /* Vertical scroll → horizontal travel. */
    if (hSection && hTrack && hMax > 0) {
      var top = hSection.getBoundingClientRect().top;
      var prog = Math.min(1, Math.max(0, -top / hMax));
      hTrack.style.transform = 'translate3d(' + (-prog * hMax).toFixed(2) + 'px,0,0)';
      if (hIndex) {
        var count = hTrack.children.length;
        var idx = Math.min(count, Math.floor(prog * count) + 1);
        var pad = ('0' + idx).slice(-2);
        if (hIndex.textContent !== pad) hIndex.textContent = pad;
      }
      if (hBar) hBar.style.transform = 'translateX(' + (prog * 300).toFixed(2) + '%)';
    }

    ticking = false;
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });
  window.addEventListener('orientationchange', function () {
    window.setTimeout(function () { measure(); onScroll(); }, 200);
  });
  if (reduce.addEventListener) reduce.addEventListener('change', function () { measure(); onScroll(); });
  window.addEventListener('load', function () { measure(); onScroll(); });
  measure();
  onScroll();

  /* Non-pinned fallback: keep the counter honest while swiping. */
  if (hTrack) {
    hTrack.addEventListener('scroll', function () {
      if (hMax > 0) return;
      var max = hTrack.scrollWidth - hTrack.clientWidth;
      var prog = max > 0 ? hTrack.scrollLeft / max : 0;
      var count = hTrack.children.length;
      if (hIndex) hIndex.textContent = ('0' + Math.min(count, Math.floor(prog * count) + 1)).slice(-2);
      if (hBar) hBar.style.transform = 'translateX(' + (prog * 300) + '%)';
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     6. Studio gallery — drag, arrows, progress
     --------------------------------------------------------- */
  (function gallery() {
    var gal = document.querySelector('[data-gallery]');
    if (!gal) return;
    var bar = document.querySelector('[data-gal-bar]');
    var prev = document.querySelector('[data-gal-prev]');
    var next = document.querySelector('[data-gal-next]');

    function step() {
      var first = gal.querySelector('.shot');
      return first ? first.offsetWidth + 20 : gal.clientWidth * 0.7;
    }
    function progress() {
      if (!bar) return;
      var max = gal.scrollWidth - gal.clientWidth;
      var ratio = gal.clientWidth / gal.scrollWidth;
      bar.style.width = (ratio * 100).toFixed(2) + '%';
      var p = max > 0 ? gal.scrollLeft / max : 0;
      bar.style.transform = 'translateX(' + (p * (100 / ratio - 100)).toFixed(2) + '%)';
    }
    if (prev) prev.addEventListener('click', function () { gal.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { gal.scrollBy({ left: step(), behavior: 'smooth' }); });
    gal.addEventListener('scroll', progress, { passive: true });
    window.addEventListener('resize', progress);
    progress();

    // Pointer drag (desktop affordance; touch already scrolls natively).
    var down = false, startX = 0, startLeft = 0, moved = 0;
    gal.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0;
      startX = e.clientX; startLeft = gal.scrollLeft;
      gal.classList.add('is-drag');
    });
    gal.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      gal.scrollLeft = startLeft - dx;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      gal.addEventListener(ev, function () { down = false; gal.classList.remove('is-drag'); });
    });
    gal.addEventListener('click', function (e) { if (moved > 6) e.preventDefault(); }, true);
  })();

  /* ---------------------------------------------------------
     7. Membership tiers
     --------------------------------------------------------- */
  (function tiers() {
    var group = document.querySelector('.plan__tiers');
    if (!group) return;
    var price = document.querySelector('[data-plan-price]');
    var per = document.querySelector('[data-plan-per]');
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('.tier');
      if (!btn) return;
      group.querySelectorAll('.tier').forEach(function (t) { t.classList.remove('is-active'); });
      btn.classList.add('is-active');
      if (price) price.textContent = btn.getAttribute('data-price');
      if (per) per.textContent = btn.getAttribute('data-per');
    });
  })();

  /* ---------------------------------------------------------
     7b. Schedule — day tabs on small screens, detail on tap
     --------------------------------------------------------- */
  (function schedule() {
    var sched = document.getElementById('schedule');
    var modal = document.getElementById('classinfo');
    if (!sched) return;

    /* Day tabs. Without JS every day stays visible, so nothing is ever hidden
       behind a control that isn't there. */
    var tabs = document.getElementById('sched-tabs');
    var days = Array.prototype.slice.call(sched.querySelectorAll('.day'));
    var narrow = window.matchMedia('(max-width: 980px)');
    var active = days.length ? days[0].getAttribute('data-day') : null;

    function paint() {
      var on = narrow.matches;
      if (tabs) tabs.hidden = !on;
      sched.classList.toggle('is-tabbed', on);
      days.forEach(function (d) {
        d.hidden = on && d.getAttribute('data-day') !== active;
      });
      if (tabs) {
        tabs.querySelectorAll('.tab').forEach(function (t) {
          var is = t.getAttribute('data-tab') === active;
          t.classList.toggle('is-active', is);
          t.setAttribute('aria-pressed', is ? 'true' : 'false');
        });
      }
    }
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var t = e.target.closest('.tab');
        if (!t) return;
        active = t.getAttribute('data-tab');
        paint();
      });
    }
    if (narrow.addEventListener) narrow.addEventListener('change', paint);
    else if (narrow.addListener) narrow.addListener(paint);
    paint();

    /* Class detail */
    if (!modal) return;
    var panel = modal.querySelector('.cinfo__panel');
    var book = modal.querySelector('[data-cinfo-book]');
    var fields = ['when', 'name', 'note', 'instructor', 'role', 'dur', 'level', 'spots'];
    var last = null;

    // handingOver: the booking panel is taking over, so leave the scroll lock
    // alone and do not yank focus back out of it half a second later.
    function close(handingOver) {
      modal.classList.remove('is-open');
      if (!handingOver) document.body.classList.remove('is-modal');
      window.setTimeout(function () {
        if (modal.classList.contains('is-open')) return;
        modal.hidden = true;
        if (handingOver) return;
        if (last && document.contains(last) && last.offsetParent !== null) {
          last.focus({ preventScroll: true });
        }
      }, 520);
    }

    sched.addEventListener('click', function (e) {
      var cell = e.target.closest('.cls');
      if (!cell) return;
      last = cell;
      fields.forEach(function (f) {
        var slot = modal.querySelector('[data-cinfo-' + f + ']');
        if (slot) slot.textContent = cell.getAttribute('data-' + f) || '';
      });
      var title = modal.querySelector('#cinfo-name');
      if (title) title.textContent = cell.getAttribute('data-name') || '';
      // Hand the chosen discipline through to the booking panel.
      if (book) book.setAttribute('data-service', cell.getAttribute('data-service') || '');
      modal.hidden = false;
      void modal.offsetWidth;
      modal.classList.add('is-open');
      document.body.classList.add('is-modal');
      var first = panel.querySelector('button');
      if (first) first.focus({ preventScroll: true });
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-cinfo-book]')) { close(true); return; }
      if (e.target.closest('[data-cinfo-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !modal.classList.contains('is-open')) return;
      close();
    });
  })();

  /* ---------------------------------------------------------
     8. Booking
     --------------------------------------------------------- */
  (function booking() {
    var modal = document.getElementById('booking');
    if (!modal) return;
    var panel = modal.querySelector('.booking__panel');
    var form = document.getElementById('booking-form');
    var done = modal.querySelector('.booking__done');
    var service = document.getElementById('booking-service');
    var last = null;

    function open(trigger) {
      last = trigger || null;
      var want = trigger && trigger.getAttribute('data-service');
      if (want && service) {
        Array.prototype.forEach.call(service.options, function (o) {
          if (o.value === want || o.textContent === want) service.value = o.value;
        });
      }
      modal.hidden = false;
      void modal.offsetWidth;
      modal.classList.add('is-open');
      document.body.classList.add('is-modal');
      var focusable = panel.querySelector('input, select, button');
      if (focusable) focusable.focus({ preventScroll: true });
    }
    function close() {
      modal.classList.remove('is-open');
      document.body.classList.remove('is-modal');
      window.setTimeout(function () {
        if (modal.classList.contains('is-open')) return;
        modal.hidden = true;
        if (form) { form.hidden = false; form.reset(); }
        if (done) done.hidden = true;
        if (last && document.contains(last)) last.focus({ preventScroll: true });
      }, 520);
    }

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('.js-book');
      if (trigger) { e.preventDefault(); open(trigger); return; }
      if (e.target.closest('[data-book-close]')) { e.preventDefault(); close(); }
    });

    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea');
      f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });

    var slots = modal.querySelector('.slots');
    if (slots) {
      slots.addEventListener('click', function (e) {
        var s = e.target.closest('.slot');
        if (!s) return;
        slots.querySelectorAll('.slot').forEach(function (x) { x.classList.remove('is-active'); });
        s.classList.add('is-active');
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = form.querySelector('[name="name"]');
        var email = form.querySelector('[name="email"]');
        var bad = null;
        if (!name.value.trim()) bad = name;
        else if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) bad = email;
        if (bad) {
          bad.style.borderColor = '#9C5C4E';
          bad.focus();
          bad.addEventListener('input', function once() {
            bad.style.borderColor = '';
            bad.removeEventListener('input', once);
          });
          return;
        }
        form.hidden = true;
        if (done) { done.hidden = false; done.querySelector('button').focus({ preventScroll: true }); }
      });
    }
  })();

  /* ---------------------------------------------------------
     9. Anchor offset for the fixed header
     --------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id === '#') return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    var top = target.getBoundingClientRect().top + window.scrollY - (window.innerWidth > 980 ? 70 : 56);
    window.scrollTo({ top: top, behavior: motionOK() ? 'smooth' : 'auto' });
  });

})();
