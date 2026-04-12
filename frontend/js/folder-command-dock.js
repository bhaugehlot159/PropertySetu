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
