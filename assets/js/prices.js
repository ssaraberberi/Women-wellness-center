/* ============================================================
   DUA — whether the packages say what they cost
   ------------------------------------------------------------
   The studio holds the prices back until it is ready to publish them,
   and flips that from the app rather than from a deploy. The page asks
   the API once and, only on a clear yes, reveals them.

   Hidden is the default in the stylesheet, not here. So a reader with no
   JavaScript, an API that is down, a slow answer, a reply that is not
   what we expect — every one of those leaves the prices in. The only
   path that shows a price is the one where the studio said to.
   ============================================================ */
(function () {
  'use strict';
  try {
    fetch('/api/public/settings', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.showPrices === true) document.documentElement.classList.add('prices');
      })
      .catch(function () {});
  } catch (e) {}
})();
