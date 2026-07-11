(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/manifest.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.icons && data.icons[0]) {
          const logoUrl = data.icons[0].src;
          let favIcon = document.querySelector('link[rel="icon"]');
          if (!favIcon) {
            favIcon = document.createElement('link');
            favIcon.rel = 'icon';
            document.head.appendChild(favIcon);
          }
          favIcon.href = logoUrl;

          let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
          if (!appleIcon) {
            appleIcon = document.createElement('link');
            appleIcon.rel = 'apple-touch-icon';
            document.head.appendChild(appleIcon);
          }
          appleIcon.href = logoUrl;
        }
      })
      .catch(console.error);

    var header = document.querySelector('.admin-header');
    var sidebar = document.querySelector('.admin-sidebar');
    if (!header || !sidebar) return;

    document.body.classList.add('admin-mobile-ready');

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-menu-toggle';
    toggle.setAttribute('aria-label', 'Открыть меню админки');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true"></span>';

    var backdrop = document.createElement('div');
    backdrop.className = 'admin-menu-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    header.insertBefore(toggle, header.firstChild);
    document.body.appendChild(backdrop);

    function setMenu(open) {
      document.body.classList.toggle('admin-menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setMenu(!document.body.classList.contains('admin-menu-open'));
    });

    backdrop.addEventListener('click', function () {
      setMenu(false);
    });

    sidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setMenu(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setMenu(false);
    });
  });
})();
