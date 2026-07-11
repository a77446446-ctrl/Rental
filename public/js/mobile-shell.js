(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.querySelector('[data-menu-toggle]');
    var drawer = document.getElementById('mobileDrawer');
    var overlay = document.getElementById('mobileDrawerOverlay');
    var closers = document.querySelectorAll('[data-menu-close]');
    var links = document.querySelectorAll('.mobile-drawer-nav a');
    var bottomLinks = document.querySelectorAll('.mobile-bottom-nav a[data-section-link]');

    function setMenu(open) {
      if (!drawer || !overlay || !toggle) return;
      drawer.classList.toggle('open', open);
      overlay.classList.toggle('open', open);
      document.body.classList.toggle('mobile-menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    if (toggle) {
      toggle.addEventListener('click', function () {
        setMenu(!(drawer && drawer.classList.contains('open')));
      });
    }

    closers.forEach(function (item) {
      item.addEventListener('click', function () {
        setMenu(false);
      });
    });

    links.forEach(function (link) {
      link.addEventListener('click', function () {
        setMenu(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setMenu(false);
    });

    if ('IntersectionObserver' in window && bottomLinks.length) {
      var sectionIds = Array.prototype.map.call(bottomLinks, function (link) {
        return link.getAttribute('data-section-link');
      });
      var sections = sectionIds
        .map(function (id) { return document.getElementById(id); })
        .filter(Boolean);

      var observer = new IntersectionObserver(function (entries) {
        var visible = entries
          .filter(function (entry) { return entry.isIntersecting; })
          .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; })[0];
        if (!visible) return;

        bottomLinks.forEach(function (link) {
          if (link.getAttribute('data-section-link') === visible.target.id) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }, {
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0, 0.25, 0.5]
      });

      // Добавляем моментальное срабатывание по клику
      bottomLinks.forEach(function (link) {
        link.addEventListener('click', function () {
          bottomLinks.forEach(function (l) { l.classList.remove('active'); });
          this.classList.add('active');
        });
      });

      sections.forEach(function (section) { observer.observe(section); });
    }
  });
})();
