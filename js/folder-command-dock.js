(function () {
  if (document.getElementById('ps-command-dock')) return;

  var path = (window.location && window.location.pathname) || '';
  document.body.classList.add('ps-pro-surface');
  document.body.classList.add('ps-olx-mode');
  var prefix = '';
  if (path.indexOf('/client/pages/') !== -1) prefix = '../../';
  else if (path.indexOf('/folders/') !== -1) prefix = '../../';
  else if (path.indexOf('/pages/') !== -1 || path.indexOf('/legal/') !== -1) prefix = '../';
  var GLOBAL_SEARCH_KEY = 'propertysetu:global-search';

  var links = [
    { href: prefix + 'index.html', label: 'Home' },
    { href: prefix + 'pages/folder-architecture.html', label: 'Folder Architecture' },
    { href: prefix + 'folders/common/all-features.html', label: 'All Features' },
    { href: prefix + 'folders/discovery/discovery-features.html', label: 'Discovery Folder' },
    { href: prefix + 'folders/marketplace/marketplace-features.html', label: 'Marketplace Folder' },
    { href: prefix + 'folders/tools/tools-features.html', label: 'Tools Folder' },
    { href: prefix + 'folders/insights/insights-features.html', label: 'Insights Folder' },
    { href: prefix + 'folders/customer/customer-features.html', label: 'Customer Folder' },
    { href: prefix + 'folders/seller/seller-features.html', label: 'Seller Folder' },
    { href: prefix + 'folders/admin/admin-features.html', label: 'Admin Folder' },
    { href: prefix + 'folders/services/services-features.html', label: 'Services Folder' },
    { href: prefix + 'pages/buy-sell.html', label: 'Buy/Sell' },
    { href: prefix + 'pages/rent.html', label: 'Rent' },
    { href: prefix + 'pages/property-care-plans.html', label: 'Property Care' },
    { href: prefix + 'pages/structure-hub.html', label: 'Structure Hub' },
    { href: prefix + 'pages/production-deploy-checklist.html', label: 'Deploy Checklist' },
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

  function isHomeLikePath(currentPath) {
    if (!currentPath || currentPath === '/') return true;
    return /(?:^|\/)index\.html$/i.test(currentPath);
  }

  function ensureResponsiveTopbarMenu() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;
    var inner = topbar.querySelector('.topbar-inner') || topbar;
    var actions = topbar.querySelector('.auth-actions');
    if (!actions) return;
    var nav = topbar.querySelector('.main-nav') || topbar.querySelector('nav');
    var hideLegacyNav = document.body.classList.contains('ps-olx-mode');

    topbar.classList.add('has-mobile-toggle');

    var toggle = topbar.querySelector('.topbar-menu-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'topbar-menu-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open top navigation menu');
      toggle.textContent = 'Menu';
      if (actions && actions.parentNode === inner) inner.insertBefore(toggle, actions);
      else inner.appendChild(toggle);
    }

    var targets = [];
    if (nav && !hideLegacyNav) targets.push(nav);
    if (actions) targets.push(actions);
    var controls = [];
    for (var idx = 0; idx < targets.length; idx += 1) {
      var panel = targets[idx];
      if (!panel.id) panel.id = 'psTopbarPanel' + (idx + 1);
      controls.push(panel.id);
    }
    if (controls.length) toggle.setAttribute('aria-controls', controls.join(' '));

    function isCompactViewport() {
      return window.matchMedia('(max-width: 980px)').matches;
    }

    function setOpen(nextOpen) {
      var isOpen = Boolean(nextOpen) && isCompactViewport();
      topbar.classList.toggle('topbar-mobile-open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.textContent = isOpen ? 'Close' : 'Menu';
    }

    toggle.addEventListener('click', function () {
      setOpen(!topbar.classList.contains('topbar-mobile-open'));
    });

    topbar.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var clickedLink = target.closest('a[href]');
      if (!clickedLink || !isCompactViewport()) return;
      setOpen(false);
    });

    document.addEventListener('click', function (event) {
      if (!isCompactViewport()) return;
      var target = event.target;
      if (!(target instanceof Node)) return;
      if (topbar.contains(target)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (!isCompactViewport()) setOpen(false);
    });
  }

  function injectOlxShell() {
    if (document.querySelector('.ps-olx-shell')) return;
    var hostHeader = document.querySelector('.topbar') || document.querySelector('header');
    if (!hostHeader || !hostHeader.parentNode) return;

    var shell = document.createElement('section');
    shell.className = 'ps-olx-shell';
    shell.setAttribute('aria-label', 'PropertySetu quick search and categories');
    shell.innerHTML =
      '<div class="ps-olx-shell-inner">' +
      '<div class="ps-olx-row">' +
      '<a class="ps-olx-location" href="' + prefix + 'pages/city-expansion.html">Udaipur</a>' +
      '<form class="ps-olx-search" id="psOlxSearchForm" action="' + prefix + 'index.html#marketplace" method="get">' +
      '<input id="psOlxSearchInput" type="search" placeholder="Search properties, localities, categories..." autocomplete="off" />' +
      '<button id="psOlxSearchBtn" type="submit">Search</button>' +
      '</form>' +
      '<div class="ps-olx-actions" id="psOlxActions">' +
      '<button type="button" class="ps-olx-menu-toggle" id="psOlxMenuToggle" aria-expanded="false" aria-controls="psOlxChipRow">Menu</button>' +
      '<a href="' + prefix + 'user-dashboard.html">Wishlist</a>' +
      '<a href="' + prefix + 'dashboard.html">Login</a>' +
      '<a class="ps-olx-sell" href="' + prefix + 'add-property.html">+ SELL</a>' +
      '</div>' +
      '</div>' +
      '<div class="ps-olx-chip-row" id="psOlxChipRow">' +
      '<a class="ps-olx-chip ps-olx-chip-primary" href="' + prefix + 'folders/common/all-features.html">All Categories</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'index.html#marketplace">Properties</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'pages/buy-sell.html">Buy</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'pages/rent.html">Rent</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'pages/property-care-plans.html">Property Care</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'folders/tools/tools-features.html">Tools</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'folders/services/services-features.html">Services</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'seller-dashboard.html">Seller</a>' +
      '<a class="ps-olx-chip" href="' + prefix + 'admin-dashboard.html">Admin</a>' +
      '</div>' +
      '</div>';

    if (hostHeader.nextSibling) hostHeader.parentNode.insertBefore(shell, hostHeader.nextSibling);
    else hostHeader.parentNode.appendChild(shell);

    var form = shell.querySelector('#psOlxSearchForm');
    var input = shell.querySelector('#psOlxSearchInput');
    var submitBtn = shell.querySelector('#psOlxSearchBtn');
    var menuToggle = shell.querySelector('#psOlxMenuToggle');

    function runGlobalSearch() {
      var query = String(input && input.value ? input.value : '').trim();
      try {
        if (query) localStorage.setItem(GLOBAL_SEARCH_KEY, query);
        else localStorage.removeItem(GLOBAL_SEARCH_KEY);
      } catch (_error) {
        // ignore storage restrictions
      }

      var homeTarget = (prefix ? prefix : '') + 'index.html#marketplace';
      if (isHomeLikePath(path)) {
        var marketInput = document.getElementById('marketQuery');
        if (marketInput) {
          marketInput.value = query;
          marketInput.dispatchEvent(new Event('input', { bubbles: true }));
          marketInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.PropertySetuHomeFolders && typeof window.PropertySetuHomeFolders.openTarget === 'function') {
          window.PropertySetuHomeFolders.openTarget('#marketplace', { behavior: 'smooth' });
          return;
        }
        var marketplace = document.getElementById('marketplace');
        if (marketplace) {
          marketplace.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      window.location.href = homeTarget;
    }

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        runGlobalSearch();
      });
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', function (event) {
        event.preventDefault();
        runGlobalSearch();
      });
    }
    if (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        runGlobalSearch();
      });
    }

    function inCompactMode() {
      return window.matchMedia('(max-width: 980px)').matches;
    }

    function setShellMenuOpen(nextOpen) {
      if (!menuToggle) return;
      var isOpen = Boolean(nextOpen) && inCompactMode();
      shell.classList.toggle('ps-olx-open', isOpen);
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menuToggle.textContent = isOpen ? 'Close' : 'Menu';
    }

    if (menuToggle) {
      menuToggle.addEventListener('click', function () {
        setShellMenuOpen(!shell.classList.contains('ps-olx-open'));
      });
      shell.addEventListener('click', function (event) {
        var target = event.target;
        if (!(target instanceof Element)) return;
        var interactive = target.closest('.ps-olx-chip, .ps-olx-actions a');
        if (!interactive || !inCompactMode()) return;
        setShellMenuOpen(false);
      });
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        setShellMenuOpen(false);
      });
      window.addEventListener('resize', function () {
        if (!inCompactMode()) setShellMenuOpen(false);
      });
    }
  }

  function injectBackToTopButton() {
    if (document.getElementById('psBackToTopBtn')) return;
    var button = document.createElement('button');
    button.id = 'psBackToTopBtn';
    button.type = 'button';
    button.className = 'ps-back-top-btn';
    button.textContent = 'Back to top';

    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', function () {
      var visible = window.scrollY > 520;
      button.classList.toggle('visible', visible);
    }, { passive: true });

    document.body.appendChild(button);
  }

  var NOTIFICATION_KEY = 'propertySetu:notifications';
  var NOTIFICATION_PREF_KEY = 'propertySetu:notificationPrefs';

  function readJsonLocal(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJsonLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
      // storage can fail under strict browser policies
    }
  }

  function getActiveRole() {
    if (readJsonLocal('propertysetu-admin-session', null)) return 'admin';
    if (readJsonLocal('propertysetu-seller-session', null)) return 'seller';
    if (readJsonLocal('propertysetu-customer-session', null)) return 'customer';
    return 'guest';
  }

  function normalizeAudience(input) {
    if (Array.isArray(input) && input.length) {
      return input.map(function (item) { return String(item || '').toLowerCase(); });
    }
    if (typeof input === 'string' && input.trim()) {
      return [input.trim().toLowerCase()];
    }
    return ['all'];
  }

  function toNotificationEntry(payload) {
    var message = String(payload && payload.message ? payload.message : '').trim();
    if (!message) return null;
    return {
      id: (payload && payload.id) || ('n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
      title: String(payload && payload.title ? payload.title : 'PropertySetu Update').trim(),
      message: message,
      type: String(payload && payload.type ? payload.type : 'info').trim(),
      audience: normalizeAudience(payload && (payload.audience || payload.role)),
      link: String(payload && payload.link ? payload.link : '').trim(),
      createdAt: (payload && payload.createdAt) || new Date().toISOString(),
      readBy: (payload && payload.readBy && typeof payload.readBy === 'object') ? payload.readBy : {},
    };
  }

  function listNotificationsRaw() {
    var list = readJsonLocal(NOTIFICATION_KEY, []);
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && typeof item === 'object' && String(item.message || '').trim();
    });
  }

  function emitNotification(payload) {
    var entry = toNotificationEntry(payload || {});
    if (!entry) return null;
    var list = listNotificationsRaw();
    list.unshift(entry);
    if (list.length > 400) list = list.slice(0, 400);
    writeJsonLocal(NOTIFICATION_KEY, list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch (_error) {
      // no-op
    }
    return entry;
  }

  function listNotificationsForRole(role) {
    var targetRole = String(role || getActiveRole()).toLowerCase();
    return listNotificationsRaw().filter(function (item) {
      var audience = Array.isArray(item.audience) ? item.audience : ['all'];
      return audience.indexOf('all') !== -1 || audience.indexOf(targetRole) !== -1;
    });
  }

  function getUnreadCount(role) {
    var targetRole = String(role || getActiveRole()).toLowerCase();
    return listNotificationsForRole(targetRole).filter(function (item) {
      return !(item.readBy && item.readBy[targetRole]);
    }).length;
  }

  function markAllNotificationsRead(role) {
    var targetRole = String(role || getActiveRole()).toLowerCase();
    var list = listNotificationsRaw();
    var changed = false;
    for (var idx = 0; idx < list.length; idx += 1) {
      var item = list[idx];
      var audience = Array.isArray(item.audience) ? item.audience : ['all'];
      if (audience.indexOf('all') === -1 && audience.indexOf(targetRole) === -1) continue;
      item.readBy = item.readBy || {};
      if (!item.readBy[targetRole]) {
        item.readBy[targetRole] = true;
        changed = true;
      }
    }
    if (changed) {
      writeJsonLocal(NOTIFICATION_KEY, list);
      try {
        localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
      } catch (_error) {
        // no-op
      }
    }
  }

  function clearNotificationsForRole(role) {
    var targetRole = String(role || getActiveRole()).toLowerCase();
    var next = listNotificationsRaw().filter(function (item) {
      var audience = Array.isArray(item.audience) ? item.audience : ['all'];
      return !(audience.indexOf('all') !== -1 || audience.indexOf(targetRole) !== -1);
    });
    writeJsonLocal(NOTIFICATION_KEY, next);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch (_error) {
      // no-op
    }
  }

  var service = window.PropertySetuNotify || {};
  service.emit = function (payload) { return emitNotification(payload || {}); };
  service.list = function (role) { return listNotificationsForRole(role); };
  service.unreadCount = function (role) { return getUnreadCount(role); };
  service.markAllRead = function (role) { markAllNotificationsRead(role); };
  service.clearForRole = function (role) { clearNotificationsForRole(role); };
  service.getRole = function () { return getActiveRole(); };
  window.PropertySetuNotify = service;

  if (!listNotificationsRaw().length) {
    emitNotification({
      title: 'Notification Service Active',
      message: 'PropertySetu unified notifications are now live for all users.',
      audience: ['all'],
      type: 'success',
    });
    emitNotification({
      title: 'Customer Alerts',
      message: 'Wishlist, visit, bid, and listing updates will appear here.',
      audience: ['customer'],
      type: 'info',
    });
    emitNotification({
      title: 'Admin Alerts',
      message: 'Approval, report, and moderation updates will appear here.',
      audience: ['admin'],
      type: 'info',
    });
  }

  var style = document.createElement('style');
  style.textContent = [
    '.ps-dock{position:fixed;right:16px;bottom:16px;z-index:1500;font-family:Manrope,Segoe UI,sans-serif;}',
    '.ps-dock-toggle{border:0;border-radius:999px;padding:10px 14px;font-weight:800;background:#0f4d7a;color:#fff;box-shadow:0 10px 24px rgba(5,36,60,.35);cursor:pointer;}',
    '.ps-dock-panel{margin-top:8px;width:min(320px,86vw);background:#fff;border:1px solid #c9deef;border-radius:14px;box-shadow:0 14px 32px rgba(6,45,74,.2);padding:10px;display:none;}',
    '.ps-dock.open .ps-dock-panel{display:block;}',
    '.ps-dock-title{font-size:13px;font-weight:800;color:#10476f;margin:0 0 8px;}',
    '.ps-dock-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.ps-dock-role{font-size:11px;font-weight:700;color:#3e6785;background:#edf6ff;border:1px solid #cfe2f2;padding:2px 8px;border-radius:999px;}',
    '.ps-dock-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}',
    '.ps-dock-link{display:block;text-decoration:none;border:1px solid #cfe2f3;border-radius:10px;padding:7px 8px;font-size:12px;font-weight:700;color:#174c73;background:#f4faff;}',
    '.ps-dock-link:hover{background:#e8f4ff;}',
    '.ps-dock-unread{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;border-radius:999px;background:#f3bf45;color:#1f1b0b;font-size:11px;font-weight:800;margin-left:6px;}',
    '.ps-notify-box{margin-top:10px;border-top:1px solid #d6e7f5;padding-top:9px;}',
    '.ps-notify-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}',
    '.ps-notify-head strong{font-size:12px;color:#12466e;}',
    '.ps-notify-actions{display:flex;gap:6px;flex-wrap:wrap;}',
    '.ps-notify-btn{border:1px solid #c6ddef;background:#f4faff;color:#1a4f77;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;}',
    '.ps-notify-btn:hover{background:#e7f3ff;}',
    '.ps-notify-list{margin:0;padding:0;list-style:none;display:grid;gap:6px;max-height:220px;overflow:auto;}',
    '.ps-notify-item{border:1px solid #d4e6f5;border-radius:10px;background:#fbfdff;padding:7px 8px;}',
    '.ps-notify-item.unread{border-color:#a9cdec;background:#eef7ff;}',
    '.ps-notify-item strong{display:block;font-size:11.5px;color:#11476f;margin-bottom:2px;}',
    '.ps-notify-item p{margin:0;color:#33566f;font-size:11.5px;line-height:1.35;}',
    '.ps-notify-item small{display:block;margin-top:3px;color:#64819a;font-size:10px;}',
    '.ps-page-banner{margin:16px auto 14px;max-width:min(1200px,94vw);border:1px solid #bfd8eb;border-radius:16px;padding:18px;background:linear-gradient(110deg,rgba(7,44,74,.9),rgba(39,117,152,.8)),url(https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1600&q=80);background-size:cover;background-position:center;box-shadow:0 14px 32px rgba(8,45,73,.2);color:#edf8ff;}',
    '.ps-page-banner h1{margin:0 0 6px;font-size:clamp(1.05rem,2.4vw,1.45rem);line-height:1.2;color:#edf8ff !important;text-shadow:0 2px 10px rgba(4,20,34,.38);}',
    '.ps-page-banner p{margin:0;color:#d7ebf8 !important;font-size:.92rem;}',
    '.ps-photo-strip{max-width:min(1200px,94vw);margin:0 auto 14px;}',
    '.ps-photo-strip-grid{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr));}',
    '.ps-photo{position:relative;border-radius:12px;overflow:hidden;border:1px solid #bdd8eb;box-shadow:0 10px 24px rgba(8,45,73,.14);min-height:150px;}',
    '.ps-photo img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.ps-photo span{position:absolute;left:0;right:0;bottom:0;padding:8px 9px;font-size:.78rem;font-weight:700;color:#eef8ff;background:linear-gradient(to top,rgba(5,25,42,.86),rgba(5,25,42,.08));}',
    'body.ps-olx-mode{background:#f2f4f5;color:#002f34;}',
    'body.ps-olx-mode .topbar{position:sticky;top:0;z-index:1300;background:#f7f8f9 !important;border-bottom:1px solid #d6dde0;backdrop-filter:none;}',
    'body.ps-olx-mode .topbar .brand{color:#0a5ddb !important;font-weight:900;}',
    'body.ps-olx-mode .topbar .main-nav{display:none !important;}',
    'body.ps-olx-mode .topbar nav a,body.ps-olx-mode .topbar .main-nav a{color:#274f67 !important;}',
    'body.ps-olx-mode .topbar nav a:hover,body.ps-olx-mode .topbar .main-nav a:hover{color:#0a5ddb !important;}',
    'body.ps-olx-mode .topbar nav a{border:1px solid #d3dde2;border-radius:999px;padding:6px 10px;background:#ffffff;}',
    'body.ps-olx-mode .auth-actions{display:flex;gap:8px;align-items:center;}',
    'body.ps-olx-mode .auth-actions .outline-btn{background:#fff !important;color:#18435d !important;border:1px solid #c7d2d8 !important;}',
    'body.ps-olx-mode .auth-actions .solid-btn{background:#0a5ddb !important;color:#fff !important;border:1px solid #0a5ddb !important;box-shadow:none !important;}',
    'body.ps-olx-mode .session-badge{background:#eff3f5 !important;color:#2d4e61 !important;border:1px solid #d1dde2 !important;}',
    '.ps-olx-shell{position:sticky;top:64px;z-index:1250;background:#f7f8f9;border-bottom:1px solid #d7e0e4;}',
    '.ps-olx-shell-inner{width:min(1280px,96vw);margin:0 auto;padding:10px 0 8px;}',
    '.ps-olx-row{display:grid;grid-template-columns:230px 1fr auto;gap:10px;align-items:center;}',
    '.ps-olx-location{display:flex;align-items:center;justify-content:center;border:1px solid #cfd9de;background:#fff;border-radius:999px;padding:11px 12px;font-weight:800;color:#18435d;text-decoration:none;}',
    '.ps-olx-search{display:grid;grid-template-columns:1fr auto;gap:8px;}',
    '.ps-olx-search input{height:46px;border:1px solid #cfd9de;border-radius:999px;padding:0 16px;font-size:1rem;background:#fff;color:#12384d;}',
    '.ps-olx-search button{height:46px;border:1px solid #0a5ddb;border-radius:999px;padding:0 18px;background:#0a5ddb;color:#fff;font-weight:800;cursor:pointer;}',
    '.ps-olx-search button:hover{background:#084fb8;}',
    '.ps-olx-actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;}',
    '.ps-olx-menu-toggle{display:none;border:1px solid #c7d3d9;background:#ffffff;border-radius:999px;padding:8px 12px;color:#18435d;font-size:.82rem;font-weight:800;cursor:pointer;}',
    '.ps-olx-menu-toggle:hover{background:#edf4f8;}',
    '.ps-olx-actions a{text-decoration:none;color:#1d3f57;font-weight:800;font-size:.88rem;}',
    '.ps-olx-actions .ps-olx-sell{padding:10px 18px;border:2px solid #f5c244;border-radius:999px;background:#0a5ddb;color:#fff;box-shadow:inset 0 0 0 2px #36c5cf;}',
    '.ps-olx-chip-row{display:flex;gap:8px;overflow-x:auto;padding:10px 2px 2px;}',
    '.ps-olx-chip{flex:0 0 auto;text-decoration:none;border:1px solid #d2dbe0;border-radius:999px;background:#fff;color:#163f58;padding:8px 14px;font-weight:700;font-size:.86rem;}',
    '.ps-olx-chip:hover{background:#f2f6f8;}',
    '.ps-olx-chip.ps-olx-chip-primary{background:#0a5ddb;color:#fff;border-color:#0a5ddb;}',
    '.ps-back-top-btn{position:fixed;right:22px;bottom:92px;z-index:1450;border:1px solid #b9c8cf;border-radius:999px;background:#fff;color:#173f57;padding:10px 14px;font-weight:800;box-shadow:0 8px 18px rgba(0,0,0,.18);opacity:0;pointer-events:none;transform:translateY(10px);transition:all .2s ease;}',
    '.ps-back-top-btn.visible{opacity:1;pointer-events:auto;transform:translateY(0);}',
    'body.ps-olx-mode .section{background:transparent !important;border-top:0 !important;padding:24px 0;}',
    'body.ps-olx-mode .desktop-dock-shell{display:none !important;}',
    'body.ps-olx-mode .hero-market{background:transparent !important;padding-bottom:8px;}',
    'body.ps-olx-mode .hero-gradient,body.ps-olx-mode .hero-pattern{display:none !important;}',
    'body.ps-olx-mode .hero-layout{grid-template-columns:1fr !important;padding-top:16px !important;}',
    'body.ps-olx-mode .hero-copy{background:#fff;border:1px solid #d7dfe4;border-radius:12px;padding:14px 16px;box-shadow:none;}',
    'body.ps-olx-mode .hero-copy .eyebrow,body.ps-olx-mode .hero-copy .hero-subline,body.ps-olx-mode .hero-copy .hero-badges{display:none !important;}',
    'body.ps-olx-mode .hero-copy h1{color:#0e3a52 !important;text-shadow:none !important;font-size:1.45rem;}',
    'body.ps-olx-mode .hero-copy .hero-tagline{color:#32617f !important;}',
    'body.ps-olx-mode .hero-widget{display:none !important;}',
    'body.ps-olx-mode main h1,body.ps-olx-mode main h2,body.ps-olx-mode main h3{color:#143f58 !important;text-shadow:none !important;}',
    'body.ps-olx-mode .section-header h2,body.ps-olx-mode .section-header h3{color:#143f58 !important;text-shadow:none !important;}',
    'body.ps-olx-mode .section-note,body.ps-olx-mode .tiny-note,body.ps-olx-mode .results-meta,body.ps-olx-mode .dash-meta,body.ps-olx-mode .board-status,body.ps-olx-mode .feature-status{color:#476880 !important;}',
    'body.ps-olx-mode .quick-action-strip .section-header{margin-bottom:8px;}',
    'body.ps-olx-mode .quick-action-card,.ps-olx-mode .home-folder-card,.ps-olx-mode .feature-finder-card,.ps-olx-mode .hub-box,.ps-olx-mode .role-board,.ps-olx-mode .dash-card{border-radius:10px !important;box-shadow:none !important;border:1px solid #d4dde1 !important;background:#fff !important;}',
    'body.ps-olx-mode .quick-action-links a{background:#fff !important;border-color:#cad6dc !important;color:#1f4560 !important;}',
    'body.ps-olx-mode .home-folder-tab{background:#fff;border-color:#cbd7dc;color:#1b4862;}',
    'body.ps-olx-mode .home-folder-tab.active{background:#e9f1ff;border-color:#0a5ddb;color:#0a5ddb;}',
    'body.ps-olx-mode .recent-feature-card,body.ps-olx-mode .most-used-card{border:1px solid #d4dde1;box-shadow:none;background:#fff;}',
    'body.ps-olx-mode .listing-card,body.ps-olx-mode .property-card,body.ps-olx-mode .card{box-shadow:none !important;border:1px solid #d4dde1 !important;border-radius:10px !important;background:#fff !important;}',
    'body.ps-olx-mode footer{background:#002f6c !important;border-top:0 !important;}',
    'body.ps-olx-mode .ps-global-footer{background:#002f6c !important;border-top:0 !important;}',
    '@media (max-width:980px){.ps-olx-shell{top:58px;}.ps-olx-row{grid-template-columns:1fr;gap:8px;}.ps-olx-actions{justify-content:flex-start;}.ps-olx-menu-toggle{display:inline-flex;align-items:center;justify-content:center;}.ps-olx-shell:not(.ps-olx-open) .ps-olx-actions a{display:none;}.ps-olx-shell:not(.ps-olx-open) .ps-olx-chip-row{display:none;}.ps-olx-search input,.ps-olx-search button,.ps-olx-location{height:42px;}}',
    '@media (max-width:760px){.ps-olx-shell-inner{width:min(98vw,1280px);padding:8px 0;}.ps-olx-search{grid-template-columns:1fr;}.ps-olx-search button{width:100%;}.ps-olx-chip-row{padding-top:8px;}.ps-back-top-btn{right:12px;bottom:88px;padding:8px 12px;}.ps-dock{right:10px;bottom:calc(96px + env(safe-area-inset-bottom,0px));}.ps-dock-panel{width:min(92vw,360px);}.ps-dock-grid{grid-template-columns:1fr;}body.ps-olx-mode .hero-copy{padding:12px;}body.ps-olx-mode .quick-action-board,body.ps-olx-mode .home-folder-grid{grid-template-columns:1fr !important;}}',
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

  function formatNotificationTime(iso) {
    var ts = Date.parse(String(iso || ''));
    if (!Number.isFinite(ts)) return 'just now';
    var diffMs = Date.now() - ts;
    var diffMin = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMin < 60) return diffMin + 'm ago';
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + 'h ago';
    var diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return diffDay + 'd ago';
    return new Date(ts).toLocaleDateString('en-IN');
  }

  function getNotificationPrefs() {
    var prefs = readJsonLocal(NOTIFICATION_PREF_KEY, { browser: false });
    if (!prefs || typeof prefs !== 'object') return { browser: false };
    return { browser: Boolean(prefs.browser) };
  }

  function saveNotificationPrefs(nextPrefs) {
    writeJsonLocal(NOTIFICATION_PREF_KEY, {
      browser: Boolean(nextPrefs && nextPrefs.browser),
    });
  }

  function tryBrowserNotification(entry) {
    if (!entry) return;
    var prefs = getNotificationPrefs();
    if (!prefs.browser) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(entry.title || 'PropertySetu', { body: entry.message || '' });
      } catch (_error) {
        // ignore browser restrictions
      }
    }
  }

  var baseEmit = service.emit;
  service.emit = function (payload) {
    var created = baseEmit(payload || {});
    tryBrowserNotification(created);
    window.dispatchEvent(new CustomEvent('propertysetu:notifications:update', { detail: { notification: created } }));
    return created;
  };
  window.PropertySetuNotify = service;

  ensureResponsiveTopbarMenu();
  injectOlxShell();
  injectBackToTopButton();

  function deriveBannerPageTitle() {
    var rawTitle = String(document.title || '').trim();
    var normalized = rawTitle.replace(/\s*\|.*$/, '').trim();
    if (/\s[–-]\s/.test(normalized)) {
      var chunks = normalized.split(/\s[–-]\s/).map(function (part) { return part.trim(); }).filter(Boolean);
      if (chunks.length) normalized = chunks[chunks.length - 1];
    }
    if (normalized && !/^propertysetu$/i.test(normalized)) return normalized;

    var titleNode = document.querySelector('main h1, h1, main h2, h2');
    var fallback = titleNode ? String(titleNode.textContent || '').trim() : '';
    if (fallback) return fallback;
    return 'PropertySetu Udaipur';
  }

  var hasProfessionalHero = !!document.querySelector('.pro-hero');
  var hasLegacyHero = !!document.querySelector('.hero');
  var isHomePath = /(?:^|\/)index\.html$/i.test(path);
  if (!hasProfessionalHero && !hasLegacyHero && !isHomePath) {
    var host = document.querySelector('main') || document.body;
    var pageTitle = deriveBannerPageTitle();
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

  var hasNativeFooter = !!document.querySelector('footer:not(.ps-global-footer)');
  if (!hasNativeFooter && !document.querySelector('.ps-global-footer')) {
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
      '<a href="' + prefix + 'pages/production-deploy-checklist.html">Deploy Checklist</a>' +
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
  panel.innerHTML =
    '<div class="ps-dock-title-row">' +
    '<p class="ps-dock-title">PropertySetu Folder Navigation</p>' +
    '<span class="ps-dock-role" id="psNotifyRole">role: guest</span>' +
    '</div>' +
    '<div class="ps-dock-grid"></div>' +
    '<section class="ps-notify-box">' +
    '<div class="ps-notify-head">' +
    '<strong id="psNotifyHeading">Notifications</strong>' +
    '<div class="ps-notify-actions">' +
    '<button type="button" class="ps-notify-btn" id="psEnableBrowser">Browser Off</button>' +
    '<button type="button" class="ps-notify-btn" id="psMarkAllRead">Mark Read</button>' +
    '<button type="button" class="ps-notify-btn" id="psClearRole">Clear</button>' +
    '</div>' +
    '</div>' +
    '<ul class="ps-notify-list" id="psNotifyList"></ul>' +
    '</section>';
  var grid = panel.querySelector('.ps-dock-grid');
  var notifyRole = panel.querySelector('#psNotifyRole');
  var notifyHeading = panel.querySelector('#psNotifyHeading');
  var notifyList = panel.querySelector('#psNotifyList');
  var enableBrowserBtn = panel.querySelector('#psEnableBrowser');
  var markReadBtn = panel.querySelector('#psMarkAllRead');
  var clearRoleBtn = panel.querySelector('#psClearRole');

  for (var i = 0; i < links.length; i += 1) {
    var a = document.createElement('a');
    a.className = 'ps-dock-link';
    a.href = links[i].href;
    a.textContent = links[i].label;
    grid.appendChild(a);
  }

  function updateToggleBadge() {
    var unread = getUnreadCount(getActiveRole());
    if (unread > 0) {
      button.innerHTML = 'Command Dock <span class="ps-dock-unread">' + unread + '</span>';
    } else {
      button.textContent = 'Command Dock';
    }
  }

  function renderNotificationFeed() {
    var role = getActiveRole();
    var unread = getUnreadCount(role);
    var rows = listNotificationsForRole(role).slice(0, 10);
    if (notifyRole) notifyRole.textContent = 'role: ' + role;
    if (notifyHeading) notifyHeading.textContent = 'Notifications (' + unread + ' unread)';
    if (notifyList) {
      notifyList.innerHTML = rows.length
        ? rows.map(function (item) {
          var isRead = item.readBy && item.readBy[role];
          var classes = isRead ? 'ps-notify-item' : 'ps-notify-item unread';
          var title = String(item.title || 'PropertySetu Update');
          var message = String(item.message || '');
          var audience = Array.isArray(item.audience) ? item.audience.join(', ') : 'all';
          return '<li class="' + classes + '"><strong>' + title + '</strong><p>' + message + '</p><small>' + formatNotificationTime(item.createdAt) + ' • for: ' + audience + '</small></li>';
        }).join('')
        : '<li class="ps-notify-item"><strong>No notifications</strong><p>New updates yahan show honge.</p></li>';
    }
    updateToggleBadge();
    var prefs = getNotificationPrefs();
    if (enableBrowserBtn) enableBrowserBtn.textContent = prefs.browser ? 'Browser On' : 'Browser Off';
  }

  if (enableBrowserBtn) {
    enableBrowserBtn.addEventListener('click', function () {
      if (!('Notification' in window)) {
        enableBrowserBtn.textContent = 'Not Supported';
        return;
      }
      var prefs = getNotificationPrefs();
      if (prefs.browser) {
        saveNotificationPrefs({ browser: false });
        renderNotificationFeed();
        return;
      }
      if (Notification.permission === 'granted') {
        saveNotificationPrefs({ browser: true });
        renderNotificationFeed();
        return;
      }
      Notification.requestPermission().then(function (permission) {
        saveNotificationPrefs({ browser: permission === 'granted' });
        renderNotificationFeed();
      });
    });
  }

  if (markReadBtn) {
    markReadBtn.addEventListener('click', function () {
      markAllNotificationsRead(getActiveRole());
      renderNotificationFeed();
    });
  }

  if (clearRoleBtn) {
    clearRoleBtn.addEventListener('click', function () {
      clearNotificationsForRole(getActiveRole());
      renderNotificationFeed();
    });
  }

  button.addEventListener('click', function () {
    dock.classList.toggle('open');
    renderNotificationFeed();
  });

  window.addEventListener('storage', function (event) {
    if (!event || !event.key) return;
    if (
      event.key === NOTIFICATION_KEY
      || event.key === 'propertySetu:notifications:ping'
      || event.key === 'propertysetu-customer-session'
      || event.key === 'propertysetu-admin-session'
      || event.key === 'propertysetu-seller-session'
    ) {
      renderNotificationFeed();
    }
  });

  window.addEventListener('propertysetu:notifications:update', function () {
    renderNotificationFeed();
  });

  dock.appendChild(button);
  dock.appendChild(panel);
  document.body.appendChild(dock);
  renderNotificationFeed();
})();
