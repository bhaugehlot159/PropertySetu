(function () {
  if (document.getElementById('ps-command-dock')) return;

  var path = (window.location && window.location.pathname) || '';
  document.body.classList.add('ps-pro-surface');
  var prefix = '';
  if (path.indexOf('/client/pages/') !== -1) prefix = '../../';
  else if (path.indexOf('/folders/') !== -1) prefix = '../../';
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

  var purposeOptions = [
    { value: 'all', label: 'All' },
    { value: 'Buy', label: 'Buy' },
    { value: 'Sell', label: 'Sell' },
    { value: 'Rent', label: 'Rent' },
    { value: 'Lease', label: 'Lease' },
    { value: 'Resale', label: 'Resale' },
    { value: 'Mortgage (Girvi)', label: 'Mortgage (Girvi)' },
    { value: 'Plot', label: 'Plot' },
    { value: 'Commercial', label: 'Commercial' },
    { value: 'House', label: 'House' },
    { value: 'Flat', label: 'Flat' },
    { value: 'Villa', label: 'Villa' },
    { value: 'Agriculture Land', label: 'Agriculture Land' },
    { value: 'Farm House', label: 'Farm House' },
    { value: 'Vadi', label: 'Vadi' },
    { value: 'Shop', label: 'Shop' },
    { value: 'Office', label: 'Office' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'PG/Hostel', label: 'PG/Hostel' },
    { value: 'Property Care', label: 'Property Care' },
    { value: 'Home Maintenance', label: 'Home Maintenance' },
    { value: 'Home Watch', label: 'Home Watch' },
    { value: 'Security Visit', label: 'Security Visit' },
    { value: 'Cleaning Service', label: 'Cleaning Service' },
    { value: 'Garden Care', label: 'Garden Care' },
    { value: 'Bill Payment Handling', label: 'Bill Payment Handling' },
    { value: 'Tenant Management', label: 'Tenant Management' }
  ];

  var categoryOptions = [
    { value: 'House', label: 'House' },
    { value: 'Flat', label: 'Flat' },
    { value: 'Villa', label: 'Villa' },
    { value: 'Plot', label: 'Plot' },
    { value: 'Agriculture Land', label: 'Agriculture Land' },
    { value: 'Commercial', label: 'Commercial' },
    { value: 'Shop', label: 'Shop' },
    { value: 'Office', label: 'Office' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Farm House', label: 'Farm House' },
    { value: 'Vadi', label: 'Vadi' },
    { value: 'PG / Hostel', label: 'PG / Hostel' }
  ];

  var udaipurShots = [
    {
      src: 'https://cdn.pixabay.com/photo/2018/03/19/23/07/udaipur-3241594_1280.jpg',
      alt: 'Udaipur City Palace view',
      cap: 'City Palace Investment Belt'
    },
    {
      src: 'https://cdn.pixabay.com/photo/2017/03/19/04/52/lake-pichola-2155531_1280.jpg',
      alt: 'Lake Pichola heritage waterfront',
      cap: 'Lake Pichola Lifestyle Zone'
    },
    {
      src: 'https://cdn.pixabay.com/photo/2020/12/11/22/05/udaipur-5824034_1280.jpg',
      alt: 'Udaipur skyline and urban expansion',
      cap: 'Urban + Rural Growth Corridor'
    }
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
    '.ps-page-banner p{margin:0;color:#d7ebf8;font-size:.92rem;}',
    '.ps-photo-strip{max-width:min(1200px,94vw);margin:0 auto 14px;}',
    '.ps-photo-strip-grid{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr));}',
    '.ps-photo{position:relative;border-radius:12px;overflow:hidden;border:1px solid #bdd8eb;box-shadow:0 10px 24px rgba(8,45,73,.14);min-height:150px;}',
    '.ps-photo img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.ps-photo span{position:absolute;left:0;right:0;bottom:0;padding:8px 9px;font-size:.78rem;font-weight:700;color:#eef8ff;background:linear-gradient(to top,rgba(5,25,42,.86),rgba(5,25,42,.08));}',
    '@media (max-width:900px){.ps-photo-strip-grid{grid-template-columns:1fr 1fr;}}',
    '@media (max-width:640px){.ps-photo-strip-grid{grid-template-columns:1fr;}}'
  ].join('');
  document.head.appendChild(style);

  function getSelectLabelText(selectEl) {
    if (!selectEl || !selectEl.id) return '';
    var label = document.querySelector('label[for="' + selectEl.id + '"]');
    return label ? (label.textContent || '') : '';
  }

  function normalizeSelectOptions(targetType) {
    var allSelects = document.querySelectorAll('select');
    var sourceOptions = targetType === 'purpose' ? purposeOptions : categoryOptions;
    var matcher = targetType === 'purpose' ? /purpose/i : /category/i;

    for (var i = 0; i < allSelects.length; i += 1) {
      var select = allSelects[i];
      var meta = ((select.id || '') + ' ' + (select.name || '') + ' ' + (select.className || '') + ' ' + getSelectLabelText(select)).toLowerCase();
      if (!matcher.test(meta)) continue;

      var existing = {};
      for (var j = 0; j < select.options.length; j += 1) {
        var opt = select.options[j];
        var k1 = (opt.value || '').trim().toLowerCase();
        var k2 = (opt.text || '').trim().toLowerCase();
        if (k1) existing[k1] = true;
        if (k2) existing[k2] = true;
      }

      for (var z = 0; z < sourceOptions.length; z += 1) {
        var src = sourceOptions[z];
        var key = src.value.toLowerCase();
        var keyLabel = src.label.toLowerCase();
        if (!existing[key] && !existing[keyLabel]) {
          var option = document.createElement('option');
          option.value = src.value;
          option.textContent = src.label;
          select.appendChild(option);
        }
      }
    }
  }

  function injectPhotoStripIfMissing() {
    if (document.querySelector('.udaipur-gallery') || document.querySelector('.ps-photo-strip')) return;
    var main = document.querySelector('main');
    if (!main) return;

    var strip = document.createElement('section');
    strip.className = 'ps-photo-strip';
    var html = '<div class="ps-photo-strip-grid">';
    for (var i = 0; i < udaipurShots.length; i += 1) {
      html +=
        '<figure class="ps-photo">' +
        '<img loading="lazy" src="' + udaipurShots[i].src + '" alt="' + udaipurShots[i].alt + '" />' +
        '<span>' + udaipurShots[i].cap + '</span>' +
        '</figure>';
    }
    html += '</div>';
    strip.innerHTML = html;

    var target = document.querySelector('.ps-page-banner');
    if (target && target.parentNode) {
      if (target.nextSibling) target.parentNode.insertBefore(strip, target.nextSibling);
      else target.parentNode.appendChild(strip);
    } else {
      main.insertBefore(strip, main.firstChild);
    }
  }

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

  normalizeSelectOptions('purpose');
  normalizeSelectOptions('category');
  injectPhotoStripIfMissing();

  if (!document.querySelector('.ps-global-footer')) {
    var footer = document.createElement('footer');
    footer.className = 'ps-global-footer';
    footer.innerHTML =
      '<div class="ps-global-footer-inner">' +
      '<section><h4>PropertySetu Udaipur</h4><p>Udaipur-focused verified property + care platform. Legacy data preserved, professional upgrade live.</p><span class="ps-footer-badge">Verified by PropertySetu</span></section>' +
      '<section><h4>Core Links</h4>' +
      '<a href="' + prefix + 'index.html">Home</a>' +
      '<a href="' + prefix + 'pages/buy-sell.html">Buy/Sell</a>' +
      '<a href="' + prefix + 'pages/rent.html">Rent</a>' +
      '<a href="' + prefix + 'pages/property-care-plans.html">Property Care</a>' +
      '<a href="' + prefix + 'admin-dashboard.html">Admin Dashboard</a>' +
      '</section>' +
      '<section><h4>Legal & Trust</h4>' +
      '<a href="' + prefix + 'legal/terms.html">Terms</a>' +
      '<a href="' + prefix + 'legal/privacy.html">Privacy</a>' +
      '<a href="' + prefix + 'legal/refund.html">Refund</a>' +
      '<a href="' + prefix + 'legal/disclaimer.html">Disclaimer</a>' +
      '<a href="' + prefix + 'legal/service-agreement.html">Service Agreement</a>' +
      '</section>' +
      '</div>';
    document.body.appendChild(footer);
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
