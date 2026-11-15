/* ============================================================
   DUA — Step inside: the virtual studio
   ------------------------------------------------------------
   What this is, exactly: an interactive PANORAMA. The visitor stands in
   one spot of the Reformer room and turns, looks up and down and zooms.
   It is not a 3D model and there is no walking between places.

   The current image is AI-generated from the room and is not a seamless
   360°: its left and right edges do not meet. So the scene is declared
   as a partial panorama (`haov` 205° × `vaov` 102.5°) and the viewer is
   kept inside it — no seam, no black edges. A genuine equirectangular
   360° photo later is a change to SCENES only: drop `haov`/`vaov`/
   `vOffset` and point `panorama` at the new file.

   More rooms (spa, reception) are more entries in SCENES. Each becomes a
   Pannellum scene, so `hotSpots` between them work without touching the
   interface below.

   Nothing here runs until the visitor presses "Explore the studio": the
   library (vendored, MIT, ~56 KB) and the panorama are fetched then.
   ============================================================ */
(function () {
  'use strict';

  var VENDOR = 'assets/vendor/pannellum-2.5.7/';

  var SCENES = {
    reformer: {
      title: 'Reformer studio',
      panorama: 'assets/tour/reformer-studio-pano-1774.jpg',
      strip: 'assets/tour/reformer-studio-pano-1774.jpg',
      // Partial panorama: how much of the room the image covers, in degrees.
      haov: 205,
      vaov: 102.5,
      vOffset: 0,
      // Where the visitor first looks: the DUA wall, the reformers, the curtains.
      view: { yaw: -14, pitch: -6, hfov: 100, portraitYaw: -22 },
      // The tallest the view may be, so a phone held upright is not stretched.
      maxVfov: 72,
      zoom: { min: 48, max: 110 },
      hotSpots: []          // later: { type: 'scene', sceneId: 'spa', yaw, pitch, text }
    }
  };

  var root = document.querySelector('[data-tour]');
  if (!root) return;

  var $ = function (sel) { return root.querySelector(sel); };
  var view = $('[data-tour-view]');
  var intro = $('[data-tour-intro]');
  var loading = $('[data-tour-loading]');
  var bar = $('[data-tour-bar]');
  var ui = $('[data-tour-ui]');
  var hint = $('[data-tour-hint]');
  var fallback = $('[data-tour-fallback]');
  var fullBtn = $('[data-tour-full]');
  var sceneId = root.getAttribute('data-scene') || 'reformer';
  var scene = SCENES[sceneId];

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var viewer = null;
  var resizeObs = null;
  var opening = false;

  /* ---------- what the browser can do ---------- */
  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  /* ---------- loading, with honest progress ---------- */
  var libPromise = null;
  function loadLibrary() {
    if (window.pannellum) return Promise.resolve();
    if (libPromise) return libPromise;
    libPromise = new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = VENDOR + 'pannellum.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = VENDOR + 'pannellum.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { libPromise = null; reject(new Error('viewer')); };
      document.head.appendChild(s);
    });
    return libPromise;
  }

  /* The image is fetched once here to show progress; the viewer then reads
     it from the browser cache (assets/tour is cached, see vercel.json). */
  function loadImage(src, onProgress) {
    return new Promise(function (resolve) {
      var x = new XMLHttpRequest();
      x.open('GET', src, true);
      x.responseType = 'arraybuffer';
      x.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onloadend = function () { onProgress(1); resolve(); };
      x.send();
    });
  }

  function progress(p) { bar.style.transform = 'scaleX(' + Math.max(0.04, Math.min(1, p)).toFixed(3) + ')'; }

  /* ---------- the view that suits this screen ---------- */
  var aspect = function () { return (view.clientWidth || 1) / (view.clientHeight || 1); };

  /* The widest the view may be on this frame without the room stretching
     top to bottom (a phone held upright, full screen). */
  function fitHfov() {
    var fit = 2 * Math.atan(Math.tan((scene.maxVfov / 2) * Math.PI / 180) * aspect()) * 180 / Math.PI;
    return Math.max(scene.zoom.min, Math.min(scene.zoom.max, fit));
  }

  function startView() {
    return {
      yaw: aspect() < 1 && scene.view.portraitYaw != null ? scene.view.portraitYaw : scene.view.yaw,
      pitch: scene.view.pitch,
      hfov: Math.min(scene.view.hfov, fitHfov())
    };
  }

  function refit() {
    if (!viewer) return;
    viewer.resize();
    if (viewer.getHfov() > fitHfov()) viewer.setHfov(fitHfov(), false);
  }

  function pannellumConfig() {
    var start = startView();
    var scenes = {};
    Object.keys(SCENES).forEach(function (id) {
      var s = SCENES[id];
      var c = {
        title: s.title, type: 'equirectangular', panorama: s.panorama,
        minHfov: s.zoom.min, maxHfov: s.zoom.max, hotSpots: s.hotSpots
      };
      if (s.haov) {
        // The view may go to the image's edges and no further. Pannellum needs
        // these spelled out: avoidShowingBackground reads them (without them
        // its zoom becomes NaN and the view goes blank).
        var off = s.vOffset || 0, m = 0.5;
        c.haov = s.haov; c.vaov = s.vaov; c.vOffset = off;
        c.minYaw = -s.haov / 2 + m; c.maxYaw = s.haov / 2 - m;
        c.minPitch = -s.vaov / 2 + off + m; c.maxPitch = s.vaov / 2 + off - m;
      } else {
        c.minPitch = -90; c.maxPitch = 90;
      }
      if (id === sceneId) { c.yaw = start.yaw; c.pitch = start.pitch; c.hfov = start.hfov; }
      scenes[id] = c;
    });
    return {
      'default': {
        firstScene: sceneId,
        autoLoad: true,
        showControls: false,
        showZoomCtrl: false,
        showFullscreenCtrl: false,
        compass: false,
        // The page must keep scrolling under the mouse wheel; zoom is the
        // buttons, pinch, or ctrl/trackpad-pinch (handled below).
        mouseZoom: false,
        keyboardZoom: true,
        draggable: true,
        friction: reduced ? 1 : 0.12,
        avoidShowingBackground: true,
        sceneFadeDuration: reduced ? 0 : 700,
        backgroundColor: [0.953, 0.941, 0.914]
      },
      scenes: scenes
    };
  }

  /* ---------- open / close ---------- */
  function show(el, on) { el.hidden = !on; }

  function open() {
    if (viewer || opening) return;
    opening = true;
    root.classList.add('is-active');
    show(intro, false);

    if (!hasWebGL()) { openFallback(); opening = false; return; }

    progress(0);
    show(loading, true);
    var lib = 0, img = 0;
    var tick = function () { progress(lib * 0.2 + img * 0.8); };
    Promise.all([
      loadLibrary().then(function () { lib = 1; tick(); }),
      loadImage(scene.panorama, function (p) { img = p; tick(); })
    ]).then(function () {
      viewer = window.pannellum.viewer(view, pannellumConfig());
      viewer.on('load', function () {
        show(loading, false);
        root.classList.add('is-ready');
        show(ui, true);
        view.focus({ preventScroll: true });
      });
      viewer.on('error', function () { closeViewer(); openFallback(); });
      ['mousedown', 'touchstart'].forEach(function (ev) {
        viewer.on(ev, function () { root.classList.add('has-moved'); });
      });
      if (window.ResizeObserver) {
        resizeObs = new ResizeObserver(refit);
        resizeObs.observe(view);
      }
      opening = false;
    }).catch(function () {
      opening = false;
      show(loading, false);
      openFallback();
    });
  }

  function openFallback() {
    var img = $('[data-tour-strip]');
    if (!img.getAttribute('src')) img.setAttribute('src', scene.strip);
    show(fallback, true);
    root.classList.add('is-fallback');
  }

  function closeViewer() {
    if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
    if (viewer) {
      try { viewer.destroy(); } catch (e) { }   // frees the WebGL context and textures
      viewer = null;
    }
    view.innerHTML = '';
    view.className = 'tour__view';
  }

  function exit() {
    setFull(false);
    closeViewer();
    show(ui, false);
    show(loading, false);
    show(fallback, false);
    root.classList.remove('is-active', 'is-ready', 'is-fallback', 'has-moved');
    show(intro, true);
    var enter = $('[data-tour-enter]');
    if (enter) enter.focus({ preventScroll: true });
  }

  /* ---------- controls ---------- */
  function zoom(dir) {
    if (!viewer) return;
    var h = viewer.getHfov() + (dir === 'in' ? -14 : 14);
    viewer.setHfov(Math.max(scene.zoom.min, Math.min(fitHfov(), h)), reduced ? false : 380);
  }

  function reset() {
    if (!viewer) return;
    var s = startView();
    viewer.lookAt(s.pitch, s.yaw, s.hfov, reduced ? false : 900);
  }

  /* Full screen: the real thing where the browser allows it on an element,
     otherwise (iPhone Safari) the stage covers the window instead. */
  var fsEl = function () { return document.fullscreenElement || document.webkitFullscreenElement; };
  function isFull() { return !!fsEl() || root.classList.contains('is-full'); }

  function setFull(on) {
    if (on === isFull()) return;
    if (on) {
      var req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (req) {
        try {
          var r = req.call(root);
          if (r && r.catch) r.catch(function () { pseudo(true); });
        } catch (e) { pseudo(true); }
      } else {
        pseudo(true);
      }
    } else {
      if (fsEl()) {
        var exitFs = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFs) exitFs.call(document);
      }
      pseudo(false);
    }
  }

  function pseudo(on) {
    root.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('is-tour-full', on);
    syncFull();
  }

  function syncFull() {
    var on = isFull();
    fullBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    root.classList.toggle('is-fs', on);
    setTimeout(refit, 60);
  }
  document.addEventListener('fullscreenchange', syncFull);
  document.addEventListener('webkitfullscreenchange', syncFull);

  /* Wheel: the page scrolls as usual; in full screen, or with ctrl held
     (which is also how a trackpad pinch arrives), it zooms. */
  view.addEventListener('wheel', function (e) {
    if (!viewer || !(isFull() || e.ctrlKey)) return;
    e.preventDefault();
    var h = viewer.getHfov() + (e.deltaY > 0 ? 6 : -6);
    viewer.setHfov(Math.max(scene.zoom.min, Math.min(fitHfov(), h)), false);
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('is-full')) pseudo(false);
  });

  root.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-tour-enter')) open();
    else if (t.hasAttribute('data-tour-zoom')) zoom(t.getAttribute('data-tour-zoom'));
    else if (t.hasAttribute('data-tour-reset')) reset();
    else if (t.hasAttribute('data-tour-full')) setFull(!isFull());
    else if (t.hasAttribute('data-tour-exit')) exit();
  });

  /* A visitor who points at the button is about to press it: start the
     small library download early. The panorama still waits for the click. */
  var enterBtn = $('[data-tour-enter]');
  ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) {
    enterBtn.addEventListener(ev, function () { if (hasWebGL()) loadLibrary().catch(function () { }); }, { once: true, passive: true });
  });

  window.addEventListener('pagehide', closeViewer);

  // For tests and for whoever adds the next room.
  window.DUATour = { scenes: SCENES, open: open, exit: exit, get viewer() { return viewer; } };
})();
