/* ============================================================
   DUA — the three kinds of package
   ------------------------------------------------------------
   Progressive, deliberately: the markup ships with every panel open,
   so a crawler and a reader without JavaScript get the whole catalogue
   in one column. This closes two of them and wires the tabs.

   The reveal animations are driven by an observer that only sees what
   is on screen, so a panel opened halfway down the page would otherwise
   arrive invisible. Opening one settles everything inside it at once.
   ============================================================ */
(function () {
  'use strict';
  var list = document.querySelector('.tabs[role="tablist"]');
  if (!list) return;

  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
  if (panels.some(function (p) { return !p; })) return;

  function show(i, moveFocus) {
    tabs.forEach(function (tab, n) {
      var on = n === i;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
      panels[n].hidden = !on;
    });
    /* Whatever is in the panel we just opened is on screen now, whether or
       not the observer ever saw it arrive. */
    panels[i].querySelectorAll('[data-reveal], [data-reveal-lines], [data-reveal-img]')
      .forEach(function (el) { el.classList.add('is-in'); });
    if (moveFocus) tabs[i].focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { show(i); });
    tab.addEventListener('keydown', function (e) {
      /* A tab can be taken off the page when the studio sells nothing of
         that kind, and the arrows must not walk into one. */
      var live = tabs.filter(function (t) { return !t.hidden; });
      var at = live.indexOf(tab);
      var pick = function (n) { show(tabs.indexOf(live[(n + live.length) % live.length]), true); };
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!live.length) return;
      if (d) { e.preventDefault(); pick(at + d); }
      else if (e.key === 'Home') { e.preventDefault(); pick(0); }
      else if (e.key === 'End') { e.preventDefault(); pick(live.length - 1); }
    });
  });

  /* Nothing is opened here at load. The panels ship empty and hidden,
     and the packages arrive from the database a moment later; whichever
     tab ends up with something behind it is clicked by catalog.js, and
     that is what opens a panel. Without that answer the section stays as
     it is, which is the line saying the packages are coming. */
  if (!list.hidden) show(0);
})();
