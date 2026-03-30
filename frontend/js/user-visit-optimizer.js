(() => {
  if (document.getElementById('userVisitOptimizerCard')) return;

  const live = window.PropertySetuLive || {};
  const allowDemoFallback = Boolean(live.allowDemoFallback);
  const visitForm = document.getElementById('visitForm');
  const propertySelect = document.getElementById('propertySelect');
  const visitDateInput = document.getElementById('visitDate');
  const visitList = document.getElementById('visitList');
  if (!visitForm || !propertySelect || !visitDateInput || !visitList) return;

  const STYLE_ID = 'user-visit-optimizer-style';
  const CARD_ID = 'userVisitOptimizerCard';
  const VISIT_KEY = 'propertySetu:userVisits';
  const VIDEO_VISIT_KEY = 'propertySetu:videoVisits';
  const LISTINGS_KEY = 'propertySetu:listings';
  const PREF_KEY = 'propertySetu:userVisitOptimizerPrefs';
  const TRACK_KEY = 'propertySetu:userVisitReminderTrack';
  const HOUR_MS = 3600000;
  const DAY_MS = 86400000;

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const escapeHtml = (value) => (
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const writeJson = live.writeJson || ((key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // no-op
    }
  });

  const toTs = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const toIso = (value) => {
    const ts = toTs(value);
    return ts ? new Date(ts).toISOString() : '';
  };

  const toLocalInput = (value) => {
    const ts = toTs(value);
    if (!ts) return '';
    const date = new Date(ts);
    const offset = date.getTimezoneOffset();
    const local = new Date(ts - (offset * 60000));
    return local.toISOString().slice(0, 16);
  };

  const toLabel = (value) => {
    const ts = toTs(value);
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const notify = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['customer'], type });
    } else {
      const existing = readJson('propertySetu:notifications', []);
      const list = Array.isArray(existing) ? existing : [];
      list.unshift({
        id: `uvo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        message,
        type,
        audience: ['customer'],
        createdAt: new Date().toISOString(),
        readBy: {},
      });
      while (list.length > 400) list.pop();
      writeJson('propertySetu:notifications', list);
      try {
        localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
      } catch {
        // no-op
      }
    }

    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // eslint-disable-next-line no-new
        new Notification(title, { body: message });
      }
    } catch {
      // browser notification optional
    }
  };

  const getPrefs = () => {
    const current = readJson(PREF_KEY, {});
    return {
      reminderWindowHours: Math.max(1, numberFrom(current?.reminderWindowHours, 24)),
    };
  };

  const setPrefs = (next) => {
    const current = getPrefs();
    writeJson(PREF_KEY, { ...current, ...(next || {}) });
  };

  const getTrackMap = () => {
    const map = readJson(TRACK_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };

  const setTrackMap = (next) => writeJson(TRACK_KEY, next && typeof next === 'object' ? next : {});

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .uvo-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .uvo-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; align-items: center; }
#${CARD_ID} .uvo-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .uvo-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .uvo-btn.warn { background: #8f4f00; border-color: #8f4f00; }
#${CARD_ID} .uvo-select { border: 1px solid #ccd9ee; border-radius: 8px; padding: 6px 9px; }
#${CARD_ID} .uvo-kpi-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); margin-bottom: 10px; }
#${CARD_ID} .uvo-kpi { border: 1px solid #d7e6f8; border-radius: 8px; background: #f8fbff; padding: 8px; }
#${CARD_ID} .uvo-kpi small { display: block; color: #58718f; }
#${CARD_ID} .uvo-kpi b { color: #11466e; font-size: 16px; }
#${CARD_ID} .uvo-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
#${CARD_ID} .uvo-panel { border: 1px solid #dce5f1; border-radius: 10px; padding: 10px; background: #fff; }
#${CARD_ID} .uvo-panel h3 { margin: 0 0 8px; color: #11466e; font-size: 16px; }
#${CARD_ID} .uvo-slot-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
#${CARD_ID} .uvo-slot-item { border: 1px solid #dce6f5; border-radius: 8px; padding: 8px; background: #f8fbff; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
#${CARD_ID} .uvo-table-wrap { overflow: auto; }
#${CARD_ID} table { width: 100%; border-collapse: collapse; min-width: 620px; }
#${CARD_ID} th, #${CARD_ID} td { border: 1px solid #d6e1f5; padding: 7px; text-align: left; font-size: 13px; }
#${CARD_ID} th { background: #f4f8ff; color: #12466e; }
#${CARD_ID} .uvo-mini-actions { display: flex; gap: 6px; flex-wrap: wrap; }
#${CARD_ID} .uvo-mini-actions button {
  border: 1px solid #c4d7f2;
  border-radius: 999px;
  background: #fff;
  color: #12395f;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
}
@media (max-width: 900px) {
  #${CARD_ID} .uvo-grid { grid-template-columns: 1fr; }
}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Visit Booking Optimizer & Smart Reminders</h2>
    <p id="uvoStatus" class="uvo-status">Loading visit planner...</p>
    <div class="uvo-toolbar">
      <button id="uvoRefreshBtn" class="uvo-btn" type="button">Refresh Planner</button>
      <button id="uvoSuggestBtn" class="uvo-btn alt" type="button">Suggest Best Slots</button>
      <button id="uvoReminderBtn" class="uvo-btn warn" type="button">Run Reminder Nudges</button>
      <button id="uvoExportIcsBtn" class="uvo-btn alt" type="button">Export Next Visit (.ics)</button>
      <label style="font-size:13px;color:#3d5674;">
        Reminder Window
        <select id="uvoReminderWindow" class="uvo-select">
          <option value="6">6h</option>
          <option value="12">12h</option>
          <option value="24">24h</option>
          <option value="36">36h</option>
          <option value="48">48h</option>
        </select>
      </label>
    </div>
    <div id="uvoKpiGrid" class="uvo-kpi-grid"></div>
    <div class="uvo-grid">
      <section class="uvo-panel">
        <h3>Suggested Slots</h3>
        <ul id="uvoSlotList" class="uvo-slot-list"><li class="uvo-slot-item">No slot suggestions yet.</li></ul>
      </section>
      <section class="uvo-panel">
        <h3>Upcoming Visit Queue</h3>
        <div id="uvoVisitTable" class="uvo-table-wrap"></div>
      </section>
    </div>
  `;

  const visitContainer = visitForm.closest('.container');
  if (visitContainer) {
    visitContainer.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('uvoStatus');
  const refreshBtn = document.getElementById('uvoRefreshBtn');
  const suggestBtn = document.getElementById('uvoSuggestBtn');
  const reminderBtn = document.getElementById('uvoReminderBtn');
  const exportIcsBtn = document.getElementById('uvoExportIcsBtn');
  const reminderWindowEl = document.getElementById('uvoReminderWindow');
  const kpiGridEl = document.getElementById('uvoKpiGrid');
  const slotListEl = document.getElementById('uvoSlotList');
  const visitTableEl = document.getElementById('uvoVisitTable');

  let model = {
    visits: [],
    suggestions: [],
    upcoming: [],
    dueReminders: [],
    summary: {
      total: 0,
      upcoming24h: 0,
      dueReminders: 0,
      videoVisits: 0,
    },
  };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const loadListingsMap = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch (error) {
        if (!allowDemoFallback) {
          setStatus(text(error?.message, 'Live listing sync failed.'), false);
        }
      }
    }
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(item?.title, id),
        location: text(item?.location || item?.locality, 'Udaipur'),
        city: text(item?.city, 'Udaipur'),
      });
    });
    return map;
  };

  const normalizeVisit = (item = {}, source = 'visit') => {
    const propertyId = text(item.propertyId || item.listingId);
    const at = toIso(item.date || item.preferredAt || item.createdAt || item.at);
    if (!propertyId || !at) return null;
    return {
      id: text(item.id || `${source}-${propertyId}-${toTs(at)}`),
      propertyId,
      title: text(item.title || item.propertyTitle || propertyId),
      at,
      source,
      note: text(item.note),
      status: text(item.status, 'scheduled').toLowerCase(),
    };
  };

  const collectVisits = () => {
    const visits = readJson(VISIT_KEY, []);
    const videoVisits = readJson(VIDEO_VISIT_KEY, []);
    const base = [];
    (Array.isArray(visits) ? visits : []).forEach((item) => {
      const row = normalizeVisit(item, 'visit');
      if (row) base.push(row);
    });
    (Array.isArray(videoVisits) ? videoVisits : []).forEach((item) => {
      const row = normalizeVisit(item, 'video');
      if (row) base.push(row);
    });
    const map = new Map();
    base.forEach((item) => {
      const key = `${item.propertyId}:${item.at}:${item.source}`;
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()].sort((a, b) => toTs(a.at) - toTs(b.at));
  };

  const eventKey = (visit) => `${text(visit.propertyId)}:${text(visit.at)}:${text(visit.source)}`;

  const computeSuggestions = (allVisits = [], propertyId = '') => {
    const selectedPropertyId = text(propertyId || propertySelect.value);
    if (!selectedPropertyId) return [];
    const now = Date.now();
    const blocked = allVisits
      .map((row) => toTs(row.at))
      .filter((value) => value > now - HOUR_MS);

    const slots = [];
    const hourSlots = [10, 12, 15, 17, 19];
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      for (const hour of hourSlots) {
        const base = new Date();
        base.setDate(base.getDate() + dayOffset);
        base.setSeconds(0, 0);
        base.setMinutes(0);
        base.setHours(hour);
        const ts = base.getTime();
        if (ts <= now + (90 * 60000)) continue;
        const hasConflict = blocked.some((value) => Math.abs(value - ts) < (75 * 60000));
        if (hasConflict) continue;
        slots.push({
          propertyId: selectedPropertyId,
          at: new Date(ts).toISOString(),
          score: Math.max(1, 100 - (dayOffset * 8) - Math.abs(16 - hour) * 2),
        });
        if (slots.length >= 6) return slots;
      }
    }
    return slots;
  };

  const computeModel = (visits = [], listingsMap = new Map(), reminderWindowHours = 24) => {
    const now = Date.now();
    const trackMap = getTrackMap();
    const merged = visits.map((visit) => {
      const listing = listingsMap.get(visit.propertyId);
      return {
        ...visit,
        title: text(visit.title || listing?.title, visit.propertyId),
        location: text(listing?.location, 'Udaipur'),
        city: text(listing?.city, 'Udaipur'),
      };
    });

    const upcoming = merged.filter((visit) => toTs(visit.at) >= now).sort((a, b) => toTs(a.at) - toTs(b.at));
    const upcoming24h = upcoming.filter((visit) => (toTs(visit.at) - now) <= (24 * HOUR_MS)).length;
    const videoVisits = merged.filter((visit) => visit.source === 'video').length;

    const dueReminders = upcoming.filter((visit) => {
      const diffHours = Math.floor((toTs(visit.at) - now) / HOUR_MS);
      if (diffHours < 0 || diffHours > reminderWindowHours) return false;
      const key = eventKey(visit);
      const track = trackMap[key] || {};
      const snoozeUntil = toTs(track.snoozeUntil);
      if (snoozeUntil > now) return false;
      const lastReminder = toTs(track.lastReminderAt);
      const cooldown = 6 * HOUR_MS;
      return !lastReminder || (now - lastReminder) >= cooldown;
    });

    return {
      visits: merged,
      upcoming,
      dueReminders,
      suggestions: computeSuggestions(merged),
      summary: {
        total: merged.length,
        upcoming24h,
        dueReminders: dueReminders.length,
        videoVisits,
      },
    };
  };

  const renderKpis = () => {
    const s = model.summary || {};
    kpiGridEl.innerHTML = `
      <div class="uvo-kpi"><small>Total Visits</small><b>${numberFrom(s.total, 0)}</b></div>
      <div class="uvo-kpi"><small>Upcoming 24h</small><b>${numberFrom(s.upcoming24h, 0)}</b></div>
      <div class="uvo-kpi"><small>Due Reminders</small><b>${numberFrom(s.dueReminders, 0)}</b></div>
      <div class="uvo-kpi"><small>Video Visits</small><b>${numberFrom(s.videoVisits, 0)}</b></div>
    `;
  };

  const renderSuggestions = () => {
    if (!model.suggestions.length) {
      slotListEl.innerHTML = '<li class="uvo-slot-item">No available suggestion. Select property and refresh.</li>';
      return;
    }
    slotListEl.innerHTML = model.suggestions.map((slot) => `
      <li class="uvo-slot-item">
        <span><b>${escapeHtml(toLabel(slot.at))}</b><br><small>Score ${numberFrom(slot.score, 0)}</small></span>
        <div class="uvo-mini-actions">
          <button type="button" data-slot-use="${escapeHtml(slot.at)}">Use</button>
        </div>
      </li>
    `).join('');
  };

  const renderVisits = () => {
    if (!model.upcoming.length) {
      visitTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No upcoming visits found.</p>';
      return;
    }
    visitTableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Schedule</th>
            <th>Type</th>
            <th>Reminder</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${model.upcoming.slice(0, 16).map((visit) => {
            const due = model.dueReminders.some((item) => eventKey(item) === eventKey(visit));
            return `
              <tr>
                <td>${escapeHtml(visit.title)}<br><small>${escapeHtml(`${visit.location}, ${visit.city}`)}</small></td>
                <td>${escapeHtml(toLabel(visit.at))}</td>
                <td>${escapeHtml(visit.source === 'video' ? 'Video' : 'On-site')}</td>
                <td>${due ? '<span style="color:#9f5d00;font-weight:700;">Due</span>' : '-'}</td>
                <td>
                  <div class="uvo-mini-actions">
                    <button type="button" data-visit-fill="${escapeHtml(visit.at)}" data-visit-property="${escapeHtml(visit.propertyId)}">Use In Form</button>
                    <button type="button" data-visit-remind="${escapeHtml(eventKey(visit))}">Remind</button>
                    <button type="button" data-visit-snooze="${escapeHtml(eventKey(visit))}">Snooze</button>
                    <button type="button" data-visit-map="${escapeHtml(visit.propertyId)}">Map</button>
                    <button type="button" data-visit-ics="${escapeHtml(eventKey(visit))}">ICS</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  };

  const buildIcs = (visit) => {
    const startTs = toTs(visit.at);
    if (!startTs) return '';
    const endTs = startTs + (60 * 60000);
    const toIcsTs = (value) => {
      const d = new Date(value);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const min = String(d.getUTCMinutes()).padStart(2, '0');
      const sec = String(d.getUTCSeconds()).padStart(2, '0');
      return `${yyyy}${mm}${dd}T${hh}${min}${sec}Z`;
    };
    const uid = `${eventKey(visit)}@propertysetu`;
    const summary = `Property Visit: ${visit.title}`;
    const location = `${visit.location}, ${visit.city}`;
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PropertySetu//Visit Optimizer//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toIcsTs(Date.now())}`,
      `DTSTART:${toIcsTs(startTs)}`,
      `DTEND:${toIcsTs(endTs)}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      'DESCRIPTION:Visit booked via PropertySetu User Dashboard',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  };

  const downloadIcs = (visit) => {
    const ics = buildIcs(visit);
    if (!ics) {
      setStatus('ICS generate failed.', false);
      return;
    }
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `property-visit-${new Date(toTs(visit.at)).toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Visit calendar file downloaded.');
  };

  const openMap = (visit) => {
    const query = `${visit.location}, ${visit.city}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const fillVisitForm = (visit) => {
    propertySelect.value = visit.propertyId;
    visitDateInput.value = toLocalInput(visit.at);
    try {
      propertySelect.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      // no-op
    }
    setStatus(`Visit form filled for ${visit.title}.`);
  };

  const runReminders = ({ silent = false } = {}) => {
    const due = model.dueReminders || [];
    if (!due.length) {
      if (!silent) setStatus('No due reminders found.');
      return;
    }
    const trackMap = getTrackMap();
    due.forEach((visit) => {
      const key = eventKey(visit);
      notify(
        'Visit Reminder',
        `${visit.title} scheduled at ${toLabel(visit.at)} (${visit.source === 'video' ? 'Video' : 'On-site'}).`,
        'warn',
      );
      trackMap[key] = {
        ...(trackMap[key] || {}),
        lastReminderAt: new Date().toISOString(),
      };
    });
    setTrackMap(trackMap);
    if (!silent) setStatus(`Reminder nudges sent: ${due.length}.`);
  };

  const manualRemind = (key) => {
    const visit = model.upcoming.find((item) => eventKey(item) === key);
    if (!visit) return;
    notify(
      'Manual Visit Reminder',
      `${visit.title} at ${toLabel(visit.at)}.`,
      'info',
    );
    const trackMap = getTrackMap();
    trackMap[key] = {
      ...(trackMap[key] || {}),
      lastReminderAt: new Date().toISOString(),
    };
    setTrackMap(trackMap);
    setStatus('Manual reminder sent.');
  };

  const snoozeReminder = (key, hours = 12) => {
    const trackMap = getTrackMap();
    trackMap[key] = {
      ...(trackMap[key] || {}),
      snoozeUntil: new Date(Date.now() + (Math.max(1, numberFrom(hours, 12)) * HOUR_MS)).toISOString(),
    };
    setTrackMap(trackMap);
    setStatus('Reminder snoozed for 12h.');
  };

  const refreshModel = async () => {
    setStatus('Refreshing visit optimizer...');
    const prefs = getPrefs();
    reminderWindowEl.value = String(prefs.reminderWindowHours);
    const listingsMap = await loadListingsMap();
    const visits = collectVisits();
    model = computeModel(visits, listingsMap, prefs.reminderWindowHours);
    renderKpis();
    renderSuggestions();
    renderVisits();
    setStatus(`Visit planner ready. ${numberFrom(model.summary.dueReminders, 0)} reminder(s) due.`);
  };

  const findVisitByKey = (key) => model.upcoming.find((visit) => eventKey(visit) === key);

  slotListEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const at = text(target.getAttribute('data-slot-use'));
    if (!at) return;
    propertySelect.value = text(propertySelect.value);
    visitDateInput.value = toLocalInput(at);
    setStatus(`Suggested slot applied: ${toLabel(at)}`);
  });

  visitTableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const fillAt = text(target.getAttribute('data-visit-fill'));
    const fillProperty = text(target.getAttribute('data-visit-property'));
    const remindKey = text(target.getAttribute('data-visit-remind'));
    const snoozeKey = text(target.getAttribute('data-visit-snooze'));
    const mapPropertyId = text(target.getAttribute('data-visit-map'));
    const icsKey = text(target.getAttribute('data-visit-ics'));

    if (fillAt && fillProperty) {
      const visit = model.upcoming.find((item) => item.propertyId === fillProperty && item.at === fillAt);
      if (visit) fillVisitForm(visit);
      return;
    }
    if (remindKey) {
      manualRemind(remindKey);
      refreshModel().catch(() => null);
      return;
    }
    if (snoozeKey) {
      snoozeReminder(snoozeKey, 12);
      refreshModel().catch(() => null);
      return;
    }
    if (mapPropertyId) {
      const visit = model.upcoming.find((item) => item.propertyId === mapPropertyId);
      if (visit) openMap(visit);
      return;
    }
    if (icsKey) {
      const visit = findVisitByKey(icsKey);
      if (visit) downloadIcs(visit);
    }
  });

  refreshBtn?.addEventListener('click', () => {
    refreshModel().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  suggestBtn?.addEventListener('click', () => {
    model.suggestions = computeSuggestions(model.visits, propertySelect.value);
    renderSuggestions();
    setStatus(`Generated ${model.suggestions.length} slot suggestion(s).`);
  });

  reminderBtn?.addEventListener('click', () => {
    runReminders({ silent: false });
    refreshModel().catch(() => null);
  });

  exportIcsBtn?.addEventListener('click', () => {
    const nearest = (model.upcoming || [])[0];
    if (!nearest) {
      setStatus('No upcoming visit for ICS export.', false);
      return;
    }
    downloadIcs(nearest);
  });

  reminderWindowEl?.addEventListener('change', () => {
    const hours = Math.max(1, numberFrom(reminderWindowEl.value, 24));
    setPrefs({ reminderWindowHours: hours });
    refreshModel().catch((error) => setStatus(text(error?.message, 'Unable to apply window.'), false));
  });

  visitForm?.addEventListener('submit', () => {
    window.setTimeout(() => {
      refreshModel().catch(() => null);
    }, 200);
  });

  refreshModel().then(() => {
    runReminders({ silent: true });
  }).catch((error) => {
    setStatus(text(error?.message, 'Unable to load visit optimizer.'), false);
  });

  window.setInterval(() => {
    refreshModel().then(() => runReminders({ silent: true })).catch(() => null);
  }, 60000);
})();
