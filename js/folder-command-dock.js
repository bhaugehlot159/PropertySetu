(function () {
  if (document.getElementById('ps-command-dock')) return;

  var path = (window.location && window.location.pathname) || '';
  document.body.classList.add('ps-pro-surface');
  var prefix = '';
  if (path.indexOf('/folders/') !== -1) prefix = '../../';
  else if (path.indexOf('/pages/') !== -1 || path.indexOf('/legal/') !== -1) prefix = '../';

  var links = [
    { href: prefix + 'index.html', label: 'Home' },
    { href: prefix + 'pages/folder-architecture.html', label: 'Folder Architecture' },
    { href: prefix + 'folders/common/all-features.html', label: 'All Features' },
    { href: prefix + 'folders/customer/customer-features.html', label: 'Customer Folder' },
    { href: prefix + 'folders/admin/admin-features.html', label: 'Admin Folder' },
    { href: prefix + 'pages/buy-sell.html', label: 'Buy/Sell' },
    { href: prefix + 'pages/rent.html', label: 'Rent' },
    { href: prefix + 'pages/property-care-plans.html', label: 'Property Care' },
    { href: prefix + 'pages/structure-hub.html', label: 'Structure Hub' },
    { href: prefix + 'admin-dashboard.html', label: 'Admin Dashboard' },
  ];

  var style = document.createElement('style');
  style.textContent = [
    '.ps-dock{position:fixed;right:16px;bottom:16px;z-index:1500;font-family:Manrope,Segoe UI,sans-serif;}',
    '.ps-dock-toggle{border:0;border-radius:999px;padding:10px 14px;font-weight:800;background:#0f4d7a;color:#fff;box-shadow:0 10px 24px rgba(5,36,60,.35);cursor:pointer;}',
    '.ps-dock-panel{margin-top:8px;width:min(320px,86vw);background:#fff;border:1px solid #c9deef;border-radius:14px;box-shadow:0 14px 32px rgba(6,45,74,.2);padding:10px;display:none;}',
    '.ps-dock.open .ps-dock-panel{display:block;}',
    '.ps-dock-title{font-size:13px;font-weight:800;color:#10476f;margin:0 0 8px;}',
    '.ps-dock-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}',
    '.ps-dock-link{display:block;text-decoration:none;border:1px solid #cfe2f3;border-radius:10px;padding:7px 8px;font-size:12px;font-weight:700;color:#174c73;background:#f4faff;}',
    '.ps-dock-link:hover{background:#e8f4ff;}',
    '.ps-page-banner{margin:16px auto 14px;max-width:min(1200px,94vw);border:1px solid #bfd8eb;border-radius:16px;padding:18px;background:linear-gradient(110deg,rgba(7,44,74,.9),rgba(39,117,152,.8)),url(https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1600&q=80);background-size:cover;background-position:center;box-shadow:0 14px 32px rgba(8,45,73,.2);color:#edf8ff;}',
    '.ps-page-banner h1{margin:0 0 6px;font-size:clamp(1.05rem,2.4vw,1.45rem);line-height:1.2;}',
    '.ps-page-banner p{margin:0;color:#d7ebf8;font-size:.92rem;}'
  ].join('');
  document.head.appendChild(style);

  var hasProfessionalHero = !!document.querySelector('.pro-hero');
  var hasLegacyHero = !!document.querySelector('.hero');
  var isHomePath = /(?:^|\/)index\.html$/i.test(path);
  if (!hasProfessionalHero && !hasLegacyHero && !isHomePath) {
    var host = document.querySelector('main') || document.body;
    var titleNode = document.querySelector('main h1, main h2, h1, h2');
    var pageTitle = titleNode ? titleNode.textContent.trim() : document.title.replace(/\s*\|.*/, '');
    var banner = document.createElement('section');
    banner.className = 'ps-page-banner';
    banner.innerHTML =
      '<h1>' +
      (pageTitle || 'PropertySetu Udaipur') +
      '</h1><p>Udaipur-first professional workflow, legacy data preserved, and folder-wise uniform polish active.</p>';

    if (host === document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      host.insertBefore(banner, host.firstChild);
    }
  }

  var dock = document.createElement('div');
  dock.id = 'ps-command-dock';
  dock.className = 'ps-dock';

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'ps-dock-toggle';
  button.textContent = 'Command Dock';

  var panel = document.createElement('div');
  panel.className = 'ps-dock-panel';
  panel.innerHTML = '<p class="ps-dock-title">PropertySetu Folder Navigation</p><div class="ps-dock-grid"></div>';
  var grid = panel.querySelector('.ps-dock-grid');

  for (var i = 0; i < links.length; i += 1) {
    var a = document.createElement('a');
    a.className = 'ps-dock-link';
    a.href = links[i].href;
    a.textContent = links[i].label;
    grid.appendChild(a);
  }

  button.addEventListener('click', function () {
    dock.classList.toggle('open');
  });

  dock.appendChild(button);
  dock.appendChild(panel);
  document.body.appendChild(dock);
})();
