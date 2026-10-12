/* ============================================================
   DUA — the website's timetable
   ------------------------------------------------------------
   The ordinary week, as the studio set it under Schedule → Weekly
   schedule in the admin. Times and kinds only: who teaches and how many
   places are left belong to the booking page, which counts them live.

   On a phone it is one day at a time behind day buttons; on a wide
   screen the whole week sits side by side. English goes in, and
   i18n.js translates it on the way into the page like everything else.
   ============================================================ */
(function () {
  'use strict';

  var box = document.getElementById('timetable');
  if (!box || !window.fetch) return;

  var ORDER = [1, 2, 3, 4, 5, 6, 0];
  var SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  fetch('/api/public/timetable', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.slots || !data.slots.length) return;
      var names = {};
      (data.classTypes || []).forEach(function (t) { names[t.id] = t.short || t.name; });

      /* weekday → start time → the kinds at that hour */
      var week = {};
      data.slots.forEach(function (s) {
        var day = week[s.weekday] || (week[s.weekday] = {});
        var row = day[s.start] || (day[s.start] = { start: s.start, end: s.end, types: [] });
        if (row.types.indexOf(s.typeId) < 0) row.types.push(s.typeId);
      });

      var today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Tirane' })).getDay();
      var open = ORDER.filter(function (d) { return week[d]; });
      var current = week[today] ? today : open[0];

      var tabs = el('div', 'tt__days');
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Choose a day');
      var grid = el('div', 'tt__week');
      var cols = {}, buttons = {};

      ORDER.forEach(function (d) {
        var b = el('button', 'tt__day');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.appendChild(el('b', null, SHORT[d]));
        b.appendChild(el('i', null, week[d] ? Object.keys(week[d]).length + ' times' : 'Closed'));
        if (!week[d]) { b.disabled = true; b.classList.add('is-closed'); }
        b.addEventListener('click', function () { pick(d); });
        buttons[d] = b;
        tabs.appendChild(b);

        var col = el('div', 'tt__col' + (week[d] ? '' : ' tt__col--closed'));
        col.appendChild(el('p', 'tt__name', LONG[d]));
        var list = el('ul', 'tt__list');
        if (!week[d]) list.appendChild(el('li', 'tt__shut', 'Closed'));
        else Object.keys(week[d]).sort().forEach(function (k) {
          var row = week[d][k];
          var li = el('li', 'tt__row');
          var when = el('span', 'tt__time');
          when.appendChild(el('b', null, row.start));
          when.appendChild(el('small', null, '– ' + row.end));
          li.appendChild(when);
          var chips = el('span', 'tt__chips');
          row.types.forEach(function (t) {
            chips.appendChild(el('i', 'tt__chip tt__chip--' + (t === 'spa' ? 'spa' : 'pilates'), names[t] || t));
          });
          li.appendChild(chips);
          list.appendChild(li);
        });
        col.appendChild(list);
        cols[d] = col;
        grid.appendChild(col);
      });

      function pick(d) {
        current = d;
        ORDER.forEach(function (x) {
          var on = x === d;
          buttons[x].classList.toggle('is-on', on);
          buttons[x].setAttribute('aria-selected', on ? 'true' : 'false');
          cols[x].classList.toggle('is-on', on);
        });
      }
      pick(current);

      var key = el('p', 'tt__key');
      var kinds = {};
      data.slots.forEach(function (s) { kinds[s.typeId] = true; });
      Object.keys(kinds).forEach(function (t) {
        var k = el('span');
        k.appendChild(el('i', 'tt__chip tt__chip--' + (t === 'spa' ? 'spa' : 'pilates'), names[t] || t));
        k.appendChild(document.createTextNode(t === 'spa' ? ' one person at a time' : ' small group on the reformer'));
        key.appendChild(k);
      });

      box.appendChild(tabs);
      box.appendChild(grid);
      box.appendChild(key);
      box.hidden = false;
    })
    .catch(function () { /* the opening hours beside it still say when we are open */ });
})();
