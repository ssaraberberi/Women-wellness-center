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
    // Flip exactly when the hero's last sliver passes behind the bar. The two
    // states are mutually exclusive: light text never sits on the light bar.
    var flip = hero ? Math.max(40, hero.offsetHeight - 70) : 40;
    var light = y < flip && !document.body.classList.contains('is-menu');
    nav.classList.toggle('is-light', light);
    nav.classList.toggle('is-stuck', !light);
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
     4b. The opening — a scroll-driven disintegration
     ---------------------------------------------------------
     A second image is painted to a canvas over the hero and broken into
     tiles. Scrolling zooms the whole field, then a wave sweeps outward from
     a focal point, throwing each tile along its own radial vector until the
     hero underneath is fully exposed. Progress is lerped so trackpad jitter
     never reaches the animation.
     --------------------------------------------------------- */
  (function opening() {
    var canvas = document.querySelector('.hero__shatter');
    if (!hero || !canvas || !canvas.getContext || !motionOK()) return;

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var media = hero.querySelector('.hero__media');
    var content = hero.querySelector('.hero__content');
    var enter = hero.querySelector('.enter');
    var veil = hero.querySelector('.hero__veil');
    var dim = hero.querySelector('.hero__dim');
    var small = window.matchMedia('(max-width: 760px)');

    var off = document.createElement('canvas');
    var octx = off.getContext('2d');
    var img = new Image();
    img.decoding = 'async';

    var tiles = [], dust = [], cw = 0, ch = 0, fx = 0, fy = 0;
    var ready = false, target = 0, smooth = 0, painted = -1, running = false;

    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function outCubic(t) { var u = 1 - t; return 1 - u * u * u; }
    function inQuad(t) { return t * t; }

    // Seeded so a rebuild after resize stays visually consistent.
    var seed = 0x9e3779b9;
    function rng() {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function build() {
      var isSmall = small.matches;
      // The desktop frame is 2400px of real detail, so a 2x canvas on a 1512
      // viewport would add pixels without adding picture and cost a third of
      // the frame budget. 1.6 lands the buffer on the asset's own resolution.
      var dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 2 : 1.6);
      var wv = hero.clientWidth || window.innerWidth, hv = window.innerHeight;
      while (dpr > 1 && wv * dpr * hv * dpr > 6e6) dpr -= 0.2;
      var w = wv, h = hv;

      cw = Math.round(w * dpr); ch = Math.round(h * dpr);
      canvas.width = cw; canvas.height = ch;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      off.width = cw; off.height = ch;

      // cover-fit the source into the offscreen buffer
      var ir = img.naturalWidth / img.naturalHeight, cr = cw / ch, dw, dh, dx, dy;
      if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
      else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) * 0.42; }
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, cw, ch);
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(img, dx, dy, dw, dh);
      // High quality matters for the one resample into the buffer above. On the
      // main context it would be paid per tile, ~1000 times a frame, and the
      // tiles are drawn 1:1 anyway — that cost bought nothing and dropped the
      // frame rate to 20fps.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';

      seed = 0x9e3779b9;
      var px = (isSmall ? 40 : 42) * dpr;
      var cols = Math.max(6, Math.round(cw / px));
      var rows = Math.max(6, Math.round(ch / px));
      var tw = cw / cols, th = ch / rows;

      fx = cw * 0.5; fy = ch * 0.46;
      var maxD = Math.max(
        Math.hypot(fx, fy), Math.hypot(cw - fx, fy),
        Math.hypot(fx, ch - fy), Math.hypot(cw - fx, ch - fy)
      );
      var far = Math.max(cw, ch);

      tiles.length = 0;
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          var x = i * tw, y = j * th;
          var tcx = x + tw / 2, tcy = y + th / 2;
          var vx = tcx - fx, vy = tcy - fy;
          var d = Math.hypot(vx, vy) || 1;
          var nd = d / maxD;
          var r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
          // three depth bands give the field real parallax: near tiles leave
          // earlier, travel further and grow more.
          var band = r4 < 0.34 ? 0 : (r4 < 0.72 ? 1 : 2);
          var depth = band === 0 ? 0.70 : (band === 1 ? 1 : 1.45);
          tiles.push({
            x: x, y: y, w: tw, h: th, cx: tcx, cy: tcy,
            sw: Math.min(tw + 1, cw - x), sh: Math.min(th + 1, ch - y),
            ux: vx / d, uy: vy / d,
            // Radial order, heavily jittered — a clean expanding circle reads
            // as a wipe, a ragged one reads as something coming apart.
            start: 0.14 + nd * 0.58 + r1 * 0.06 - (band - 1) * 0.025,
            dur: 0.09 + r2 * 0.07,
            eject: (0.14 + r3 * 0.30) * far * depth,
            // Near fragments swell past the camera, far ones recede. That
            // split is most of what sells the depth.
            grow: band === 0 ? -(0.10 + r2 * 0.14) : (0.08 + r2 * 0.20) * depth,
            rot: (r1 - 0.5) * (isSmall ? 0.22 : 0.34) * depth
          });
        }
      }

      // Sorted by launch time so each frame can find the boundary between
      // "not yet moved" and "moving" with a binary search instead of a scan.
      tiles.sort(function (a, b) { return a.start - b.start; });

      dust.length = 0;
      var n = isSmall ? 26 : 64;
      for (var k = 0; k < n; k++) {
        var a = rng() * Math.PI * 2, rr = rng();
        dust.push({
          x: fx + Math.cos(a) * rr * maxD * 0.42,
          y: fy + Math.sin(a) * rr * maxD * 0.42,
          ux: Math.cos(a), uy: Math.sin(a),
          r: (1.1 + rng() * 3.2) * dpr,
          start: 0.24 + rng() * 0.32,
          dur: 0.22 + rng() * 0.30,
          travel: (0.35 + rng() * 1.1) * far * 0.5,
          rose: rng() < 0.45
        });
      }
      ready = true;
      painted = -1;
    }

    function draw(p) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Hero underneath: settles from a slight push-in as it is uncovered.
      var rev = clamp((p - 0.60) / 0.32);
      if (content) {
        content.style.opacity = rev;
        content.style.transform = 'translate3d(0,' + ((1 - rev) * 28).toFixed(2) + 'px,0)';
        // Transparent buttons are still tabbable; keep them out of the tab
        // order until they are actually on screen.
        content.style.visibility = rev > 0.02 ? '' : 'hidden';
      }
      if (media) {
        var ms = 1 + 0.10 * (1 - clamp((p - 0.22) / 0.74));
        media.style.transform = 'scale(' + ms.toFixed(4) + ')';
      }
      if (enter) enter.style.opacity = (1 - clamp(p / 0.14)).toFixed(3);
      // hand the darkening over to the hero's own scrim as it is uncovered
      if (veil) veil.style.opacity = (1 - clamp((p - 0.40) / 0.36)).toFixed(3);
      if (dim) dim.style.opacity = (0.44 * (1 - clamp((p - 0.24) / 0.52))).toFixed(3);

      if (p >= 0.965) {
        ctx.clearRect(0, 0, cw, ch);
        canvas.style.visibility = 'hidden';
        return;
      }
      canvas.style.visibility = '';

      // Global push-in. Keeps accelerating through the break-up so the
      // fragments read as passing the camera rather than just sliding.
      var k = 1 + 0.15 * outCubic(clamp(p / 0.30)) + 0.13 * clamp((p - 0.26) / 0.74);
      var gx = -cw * 0.020 * clamp(p / 0.45);
      var gy = -ch * 0.014 * clamp(p / 0.45);

      // The plate is drawn opaque over the whole frame below, so the usual
      // full clear is only needed while the push-in is too small to cover the
      // drift. Skipping it saves a full-screen fill every frame.
      if (k < 1.06) ctx.clearRect(0, 0, cw, ch);

      // Before the wave starts nothing has moved, so one drawImage does it.
      if (p < 0.185) {
        ctx.globalAlpha = 1;
        ctx.setTransform(k, 0, 0, k, fx * (1 - k) + gx, fy * (1 - k) + gy);
        ctx.drawImage(off, 0, 0);
        return;
      }

      var ex = fx * (1 - k) + gx, ey = fy * (1 - k) + gy;
      var n = tiles.length, i, t, lp;

      // Everything below `si` has launched; everything from `si` up is intact.
      var lo = 0, hi = n;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (tiles[mid].start < p) lo = mid + 1; else hi = mid; }
      var si = lo;

      ctx.globalAlpha = 1;
      if (si < n * 0.5) {
        // Early: most of the picture is whole. One blit, then punch out the
        // few that have left — clearRect costs no sampling.
        ctx.setTransform(k, 0, 0, k, ex, ey);
        ctx.drawImage(off, 0, 0);
        for (i = 0; i < si; i++) { t = tiles[i]; ctx.clearRect(t.x, t.y, t.w, t.h); }
      } else {
        // Late: blitting the whole plate only to erase most of it again is
        // two full-screen fills for nothing. Draw what is left standing.
        ctx.clearRect(0, 0, cw, ch);
        ctx.setTransform(k, 0, 0, k, ex, ey);
        for (i = si; i < n; i++) {
          t = tiles[i];
          ctx.drawImage(off, t.x, t.y, t.sw, t.sh, t.x, t.y, t.sw, t.sh);
        }
      }

      // Then only those still in the air.
      for (i = 0; i < si; i++) {
        t = tiles[i];
        lp = (p - t.start) / t.dur;
        if (lp >= 1) continue;
        var e = outCubic(lp);
        var a = 1 - inQuad(lp);
        if (a <= 0.05) continue;

        var s = 1 + e * t.grow;
        var r = t.rot * e;
        var ox = t.ux * e * t.eject;
        var oy = t.uy * e * t.eject;

        // local: rotate+scale about the tile centre, then throw it outward
        var co = Math.cos(r) * s, si = Math.sin(r) * s;
        var e1 = t.cx + ox - (co * t.cx - si * t.cy);
        var f1 = t.cy + oy - (si * t.cx + co * t.cy);

        // then the global push-in, composed by hand to avoid save/restore
        ctx.globalAlpha = a;
        ctx.setTransform(
          k * co, k * si, -k * si, k * co,
          k * (e1 - fx) + fx + gx,
          k * (f1 - fy) + fy + gy
        );
        ctx.drawImage(off, t.x, t.y, t.sw, t.sh, t.x, t.y, t.sw, t.sh);
      }

      // A faster, shallower layer of dust in front of the fragments.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (var d = 0; d < dust.length; d++) {
        var u = dust[d];
        var dp = (p - u.start) / u.dur;
        if (dp <= 0 || dp >= 1) continue;
        var de = outCubic(dp);
        var da = Math.sin(dp * Math.PI) * 0.5;
        ctx.globalAlpha = da;
        ctx.fillStyle = u.rose ? 'rgba(217,167,158,1)' : 'rgba(246,233,230,1)';
        ctx.beginPath();
        ctx.arc(u.x + u.ux * de * u.travel, u.y + u.uy * de * u.travel,
                u.r * (1 - dp * 0.4), 0, 6.283185);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function measureTarget() {
      var span = hero.offsetHeight - window.innerHeight;
      if (span <= 0) { target = 1; return; }
      target = clamp(-hero.getBoundingClientRect().top / span);
    }

    function tick() {
      smooth += (target - smooth) * 0.14;
      if (Math.abs(target - smooth) < 0.0005) smooth = target;
      if (ready && smooth !== painted) { draw(smooth); painted = smooth; }
      if (smooth !== target) window.requestAnimationFrame(tick);
      else running = false;
    }
    function kick() {
      measureTarget();
      if (!running) { running = true; window.requestAnimationFrame(tick); }
    }

    var resizeTimer;
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (!ready) return;
        build();
        kick();
      }, 180);
    }

    img.onload = function () {
      root.classList.add('has-opening');
      build();
      smooth = target = 0;
      measureTarget();
      smooth = target;
      draw(smooth);
      painted = smooth;
      window.addEventListener('scroll', kick, { passive: true });
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      if (typeof measure === 'function') measure();
    };
    img.onerror = function () {
      // No opening rather than a broken one; the hero stands on its own.
      root.classList.remove('has-opening');
      canvas.style.display = 'none';
      if (enter) enter.style.display = 'none';
      if (veil) veil.style.display = 'none';
      if (dim) dim.style.display = 'none';
      if (content) { content.style.opacity = ''; content.style.transform = ''; }
    };
    img.src = small.matches
      ? 'assets/img/opening-studio-1200.jpg'
      : 'assets/img/opening-studio-2400.jpg';
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
