/* DUA — language on the legal pages.
   Both languages are in the HTML, so the text is there for anyone without
   script and for search engines. The few lines in each page's <head> pick
   one before anything is painted (?lang= first, which the app passes, then
   the choice made on the website, then the phone's own language); this
   file only handles the AL / EN buttons. */
(function () {
  var root = document.documentElement;

  function apply(lang) {
    root.setAttribute('data-lang', lang);
    root.lang = lang;
    document.querySelectorAll('.lang button').forEach(function (b) {
      var on = b.getAttribute('data-lang') === lang;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var t = document.querySelector('meta[name="dua-title-' + lang + '"]');
    if (t) document.title = t.content;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.lang button');
    if (!b) return;
    var lang = b.getAttribute('data-lang');
    try { localStorage.setItem('dua-lang', lang); } catch (x) {}
    apply(lang);
  });

  apply(root.getAttribute('data-lang') === 'sq' ? 'sq' : 'en');
})();
