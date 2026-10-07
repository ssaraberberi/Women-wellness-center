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
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); show((i + d + tabs.length) % tabs.length, true); }
      else if (e.key === 'Home') { e.preventDefault(); show(0, true); }
      else if (e.key === 'End') { e.preventDefault(); show(tabs.length - 1, true); }
    });
  });

  show(0);
})();
