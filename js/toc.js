/* Scroll-spy for the table of contents on long blog posts: bolds the link of
   the section currently being read. Loaded only on pages that have one. */
(function () {
  'use strict';

  function init() {
    var toc = document.querySelector('nav.toc');
    if (!toc) return;

    var pairs = [];
    toc.querySelectorAll('a[href^="#"]').forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      var heading = document.getElementById(id);
      if (heading) pairs.push({ link: link, heading: heading });
    });
    if (pairs.length === 0) return;

    var current = null;

    function update() {
      // The reading line sits just below the sticky top nav; the active
      // section is the last one whose heading has scrolled past it.
      var active = null;
      for (var i = 0; i < pairs.length; i++) {
        if (pairs[i].heading.getBoundingClientRect().top <= 90) {
          active = pairs[i].link;
        }
      }
      // At the very bottom the last section is being read even if its
      // heading never crosses the reading line.
      var bottom = window.innerHeight + window.scrollY
        >= document.documentElement.scrollHeight - 2;
      if (bottom) active = pairs[pairs.length - 1].link;

      if (active === current) return;
      if (current) current.classList.remove('active');
      if (active) active.classList.add('active');
      current = active;
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
