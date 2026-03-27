(() => {
  if (document.getElementById('sellerFollowupWhatsappQueueCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const STYLE_ID = 'seller-followup-whatsapp-queue-style';
  const CARD_ID = 'sellerFollowupWhatsappQueueCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const TRACK_KEY = 'propertySetu:sellerFollowupReminderTrack';
  const SETTINGS_KEY = 'propertySetu:sellerFollowupSettings';
  const HOUR_MS = 3600000;
  const DAY_MS = 86400000;
  const REMINDER_COOLDOWN_MS = 6 * HOUR_MS;

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

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };

  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };

  const toIso = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  };

  const ts = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const toLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getTrack = () => {
    const map = readJson(TRACK_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };

  const setTrack = (next) => {
    writeJson(TRACK_KEY, next && typeof next === 'object' ? next : {});
  };

  const getSettings = () => {
    const raw = readJson(SETTINGS_KEY, {});
    return {
      thresholdHours: Math.max(1, numberFrom(raw?.thresholdHours, 24)),
    };
  };

  const setSettings = (next) => {
    const current = getSettings();
    writeJson(SETTINGS_KEY, { ...current, ...(next || {}) });
  };

  const pushNotification = (title, message, type = 'warn') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['seller', 'admin'], type });
      return;
    }
    const existing = readJson('propertySetu:notifications', []);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      id: `sfwq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      type,
      audience: ['seller', 'admin'],
      createdAt: new Date().toISOString(),
      readBy: {},
    });
    while (list.length > 500) list.pop();
    writeJson('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const normalizeChat = (item = {}, listingId = '') => {
    const propertyId = text(item.propertyId || item.listingId || listingId);
    if (!propertyId) return null;
    return {
      id: text(item.id || item._id || `${propertyId}-${Date.now()}`),
      propertyId,
      senderId: text(item.senderId || item.fromUserId),
      receiverId: text(item.receiverId || item.toUserId),
      message: text(item.message),
      createdAt: toIso(item.createdAt || item.sentAt || item.timestamp),
    };
  };

  const uniqueBy = (items = [], keyFn) => {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const key = text(keyFn(item));
      if (!key) return;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, item);
        return;
      }
      const prevTs = ts(prev.updatedAt || prev.createdAt);
      const nextTs = ts(item.updatedAt || item.createdAt);
      if (nextTs >= prevTs) map.set(key, item);
    });
    return [...map.values()];
  };

  const collectListings = (sessionId) => {
    const rows = readJson(LISTINGS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .filter((item) => item && typeof item === 'object')
      .filter((item) => !sessionId || text(item.ownerId) === sessionId);
  };

  const collectLocalChats = () => {
    const chats = [];
    try {
      const keyCount = numberFrom(localStorage.length, 0);
      for (let index = 0; index < keyCount; index += 1) {
        const key = text(localStorage.key(index));
        if (!key.startsWith(CHAT_PREFIX)) continue;
        const listingId = key.slice(CHAT_PREFIX.length);
        const items = readJson(key, []);
        (Array.isArray(items) ? items : []).forEach((entry) => {
          const normalized = normalizeChat(entry, listingId);
          if (normalized) chats.push(normalized);
        });
      }
    } catch {
      // no-op
    }
    return chats;
  };

  const collectLiveChats = async (token) => {
    if (!token || typeof live.request !== 'function') return [];
    try {
      const response = await live.request('/chat/mine', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      return items.map((entry) => normalizeChat(entry)).filter(Boolean);
    } catch {
      return [];
    }
  };

  const templateForLead = (lead) => {
    const propertyTitle = text(lead?.propertyTitle, 'your shortlisted property');
    if (numberFrom(lead?.ageHours, 0) >= 48) {
      return `Hi, follow-up from PropertySetu for ${propertyTitle}. I can help with best price, visit slot, and documents. Please share your preferred time.`;
    }
    if (numberFrom(lead?.ageHours, 0) >= 24) {
      return `Hi, this is a quick follow-up for ${propertyTitle}. Do you want to schedule a site visit or receive latest price and availability details?`;
    }
    return `Hi, thanks for your interest in ${propertyTitle}. Let me know if you want visit scheduling, payment plan, or loan support details.`;
  };

  const getLeadPriority = (ageHours) => {
    const hours = numberFrom(ageHours, 0);
    if (hours >= 48) return 'urgent';
    if (hours >= 24) return 'high';
    return 'due';
  };

  const createLeadModel = ({ chats, sessionId, listingTitleById, thresholdHours }) => {
    const map = new Map();
    (Array.isArray(chats) ? chats : []).forEach((chat) => {
      const propertyId = text(chat.propertyId);
      if (!propertyId) return;
      const senderId = text(chat.senderId);
      const receiverId = text(chat.receiverId);
      if (!sessionId || (senderId !== sessionId && receiverId !== sessionId)) return;
      const counterpartId = senderId === sessionId ? receiverId : senderId;
      if (!counterpartId) return;
      const key = `${propertyId}::${counterpartId}`;
      const existing = map.get(key) || {
        key,
        propertyId,
        propertyTitle: text(listingTitleById[propertyId], propertyId),
        counterpartId,
        lastInboundAt: '',
        lastInboundMessage: '',
        lastOutboundAt: '',
      };
      const createdAt = text(chat.createdAt);
      const createdTs = ts(createdAt);
      if (!createdTs) return;
      if (receiverId === sessionId && createdTs >= ts(existing.lastInboundAt)) {
        existing.lastInboundAt = createdAt;
        existing.lastInboundMessage = text(chat.message);
      }
      if (senderId === sessionId && createdTs >= ts(existing.lastOutboundAt)) {
        existing.lastOutboundAt = createdAt;
      }
      map.set(key, existing);
    });

    const now = Date.now();
    const trackMap = getTrack();
    const leads = [...map.values()]
      .map((row) => {
        const inboundTs = ts(row.lastInboundAt);
        const outboundTs = ts(row.lastOutboundAt);
        if (!inboundTs) return null;
        if (outboundTs && outboundTs >= inboundTs) return null;
        const ageHours = Math.floor((now - inboundTs) / HOUR_MS);
        if (ageHours < thresholdHours) return null;
        const track = trackMap[row.key] || {};
        if (text(track.handledInboundAt) === text(row.lastInboundAt)) return null;
        if (ts(track.snoozeUntil) > now) return null;
        const inboundChanged = text(track.lastInboundAt) !== text(row.lastInboundAt);
        const reminderDue = inboundChanged || (now - ts(track.lastReminderAt)) >= REMINDER_COOLDOWN_MS;
        return {
          ...row,
          markerInboundAt: text(row.lastInboundAt),
          ageHours,
          priority: getLeadPriority(ageHours),
          reminderDue,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.ageHours - a.ageHours);

    const summary = {
      dueCount: leads.length,
      urgentCount: leads.filter((lead) => lead.priority === 'urgent').length,
      propertyCount: new Set(leads.map((lead) => lead.propertyId)).size,
      avgPendingHours: leads.length
        ? Math.round(leads.reduce((sum, lead) => sum + numberFrom(lead.ageHours, 0), 0) / leads.length)
        : 0,
      reminderDueCount: leads.filter((lead) => lead.reminderDue).length,
    };

    return { leads, summary };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sfwq-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .sfwq-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
#${CARD_ID} .sfwq-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .sfwq-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .sfwq-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .sfwq-select{border:1px solid #ccd9ee;border-radius:8px;padding:6px 9px;}
#${CARD_ID} .sfwq-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .sfwq-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .sfwq-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .sfwq-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .sfwq-wrap{border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;}
#${CARD_ID} .sfwq-lead{border:1px solid #dce6f5;border-radius:9px;padding:9px;background:#fff;margin-bottom:8px;}
#${CARD_ID} .sfwq-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;}
#${CARD_ID} .sfwq-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .sfwq-chip.urgent{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sfwq-chip.high{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sfwq-chip.due{background:#e8f2ff;color:#165188;}
#${CARD_ID} .sfwq-meta{margin:6px 0;color:#4a617b;font-size:12px;line-height:1.45;}
#${CARD_ID} .sfwq-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .sfwq-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Follow-up Scheduler & WhatsApp Queue</h2>
    <p id="sfwqStatus" class="sfwq-status">Loading seller follow-up queue...</p>
    <div class="sfwq-toolbar">
      <button id="sfwqRefreshBtn" class="sfwq-btn" type="button">Refresh Queue</button>
      <button id="sfwqSchedulerBtn" class="sfwq-btn warn" type="button">Run Scheduler</button>
      <button id="sfwqCsvBtn" class="sfwq-btn alt" type="button">Export CSV</button>
      <label style="font-size:13px;color:#3d5674;">
        Follow-up due after
        <select id="sfwqThresholdSelect" class="sfwq-select">
          <option value="6">6h</option>
          <option value="12">12h</option>
          <option value="24">24h</option>
          <option value="36">36h</option>
          <option value="48">48h</option>
        </select>
      </label>
    </div>
    <div id="sfwqKpi" class="sfwq-kpi"></div>
    <div id="sfwqQueue" class="sfwq-wrap"><p style="margin:0;color:#607da8;">No due leads right now.</p></div>
  `;

  const leadScoreCard = document.getElementById('sellerLeadScoringCard');
  const conversionCard = document.getElementById('sellerConversionAnalyticsCard');
  const chatCard = document.getElementById('sellerChatInboxCard');
  const visitCard = document.getElementById('sellerVisitManagerCard');
  const containers = Array.from(document.querySelectorAll('.container'));
  const anchor = leadScoreCard || conversionCard || chatCard || visitCard || containers[1] || containers[containers.length - 1];
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('sfwqStatus');
  const refreshBtn = document.getElementById('sfwqRefreshBtn');
  const schedulerBtn = document.getElementById('sfwqSchedulerBtn');
  const csvBtn = document.getElementById('sfwqCsvBtn');
  const thresholdEl = document.getElementById('sfwqThresholdSelect');
  const kpiEl = document.getElementById('sfwqKpi');
  const queueEl = document.getElementById('sfwqQueue');

  let model = { leads: [], summary: {} };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const render = () => {
    const summary = model.summary || {};
    kpiEl.innerHTML = `
      <div class="sfwq-kpi-item"><small>Due Leads</small><b>${numberFrom(summary.dueCount, 0)}</b></div>
      <div class="sfwq-kpi-item"><small>Urgent (48h+)</small><b>${numberFrom(summary.urgentCount, 0)}</b></div>
      <div class="sfwq-kpi-item"><small>Properties Impacted</small><b>${numberFrom(summary.propertyCount, 0)}</b></div>
      <div class="sfwq-kpi-item"><small>Avg Pending Hours</small><b>${numberFrom(summary.avgPendingHours, 0)}h</b></div>
      <div class="sfwq-kpi-item"><small>Reminder Due Now</small><b>${numberFrom(summary.reminderDueCount, 0)}</b></div>
    `;

    if (!model.leads.length) {
      queueEl.innerHTML = '<h3 style="margin:0 0 8px;color:#124a72;">Follow-up Queue</h3><p style="margin:0;color:#607da8;">No due leads. Great response hygiene.</p>';
      return;
    }

    queueEl.innerHTML = `
      <h3 style="margin:0 0 8px;color:#124a72;">Follow-up Queue</h3>
      ${model.leads.map((lead) => `
        <article class="sfwq-lead">
          <div class="sfwq-head">
            <b>${escapeHtml(lead.propertyTitle)}</b>
            <span class="sfwq-chip ${escapeHtml(lead.priority)}">${lead.priority === 'urgent' ? 'Urgent' : lead.priority === 'high' ? 'High' : 'Due'}</span>
          </div>
          <div class="sfwq-meta">
            Lead: ${escapeHtml(lead.counterpartId)}<br>
            Last inbound: ${escapeHtml(toLabel(lead.lastInboundAt))}<br>
            Pending for: <b>${numberFrom(lead.ageHours, 0)}h</b><br>
            Last message: ${escapeHtml(text(lead.lastInboundMessage, '-'))}
          </div>
          <div class="sfwq-actions">
            <button type="button" data-action="send-template" data-key="${escapeHtml(lead.key)}">Send Follow-up</button>
            <button type="button" data-action="open-whatsapp" data-key="${escapeHtml(lead.key)}">WhatsApp Handoff</button>
            <button type="button" data-action="mark-handled" data-key="${escapeHtml(lead.key)}" data-inbound="${escapeHtml(lead.markerInboundAt)}">Mark Handled</button>
            <button type="button" data-action="snooze" data-key="${escapeHtml(lead.key)}">Snooze 24h</button>
          </div>
        </article>
      `).join('')}
    `;
  };

  const runScheduler = ({ silent = false } = {}) => {
    if (!model.leads.length) {
      if (!silent) setStatus('No due leads for scheduler.');
      return;
    }
    const now = Date.now();
    const trackMap = getTrack();
    let nudged = 0;
    model.leads.forEach((lead) => {
      const current = trackMap[lead.key] || {};
      const inboundChanged = text(current.lastInboundAt) !== text(lead.markerInboundAt);
      const cooldownDone = (now - ts(current.lastReminderAt)) >= REMINDER_COOLDOWN_MS;
      if (!inboundChanged && !cooldownDone) return;
      pushNotification(
        'Seller Follow-up Due',
        `${lead.propertyTitle}: ${lead.counterpartId} pending ${lead.ageHours}h.`
      );
      trackMap[lead.key] = {
        ...current,
        lastInboundAt: text(lead.markerInboundAt),
        lastReminderAt: new Date().toISOString(),
      };
      nudged += 1;
    });
    setTrack(trackMap);
    if (!silent) setStatus(nudged ? `Scheduler nudged ${nudged} lead(s).` : 'Scheduler cooldown active. No new nudges.');
  };

  const markHandled = (lead) => {
    const trackMap = getTrack();
    const current = trackMap[lead.key] || {};
    trackMap[lead.key] = {
      ...current,
      handledInboundAt: text(lead.markerInboundAt),
      handledAt: new Date().toISOString(),
      snoozeUntil: '',
    };
    setTrack(trackMap);
  };

  const snoozeLead = (lead) => {
    const trackMap = getTrack();
    const current = trackMap[lead.key] || {};
    trackMap[lead.key] = {
      ...current,
      snoozeUntil: new Date(Date.now() + DAY_MS).toISOString(),
    };
    setTrack(trackMap);
  };

  const sendTemplate = async (lead) => {
    const token = getToken();
    if (!token || typeof live.request !== 'function') {
      setStatus('Login required to send follow-up message.', false);
      return;
    }
    await live.request('/chat/send', {
      method: 'POST',
      token,
      data: {
        propertyId: lead.propertyId,
        receiverId: lead.counterpartId,
        message: templateForLead(lead),
      },
    });
    markHandled(lead);
    setStatus('Follow-up message sent successfully.');
  };

  const openWhatsapp = async (lead) => {
    const token = getToken();
    if (!token || typeof live.request !== 'function') {
      setStatus('Login required for WhatsApp handoff.', false);
      return;
    }
    const response = await live.request(`/chat/${encodeURIComponent(lead.propertyId)}/whatsapp-link?receiverId=${encodeURIComponent(lead.counterpartId)}`, { token });
    const url = text(response?.whatsapp?.url);
    if (!url) {
      setStatus('WhatsApp link unavailable for this lead.', false);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setStatus('WhatsApp handoff opened.');
  };

  const exportCsv = () => {
    const headers = ['Property ID', 'Property', 'Counterparty', 'Pending Hours', 'Last Inbound At', 'Last Outbound At', 'Priority'];
    const rows = (model.leads || []).map((lead) => ([
      lead.propertyId,
      lead.propertyTitle,
      lead.counterpartId,
      String(numberFrom(lead.ageHours, 0)),
      lead.lastInboundAt,
      lead.lastOutboundAt,
      lead.priority,
    ]));
    const quote = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((line) => line.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seller-followup-whatsapp-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Follow-up queue CSV exported.');
  };

  const refresh = async ({ schedulerPass = false } = {}) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      model = { leads: [], summary: {} };
      render();
      setStatus('Seller login required to load follow-up queue.', false);
      return;
    }

    const settings = getSettings();
    thresholdEl.value = String(settings.thresholdHours);
    setStatus('Refreshing follow-up queue...');

    const listings = collectListings(sessionId);
    const listingTitleById = {};
    listings.forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      listingTitleById[id] = text(item?.title, id);
    });

    const token = getToken();
    const [liveChats] = await Promise.all([
      collectLiveChats(token),
    ]);
    const localChats = collectLocalChats();
    const chats = uniqueBy(
      [...liveChats, ...localChats],
      (item) => text(item.id) || `${item.propertyId}:${item.senderId}:${item.receiverId}:${item.createdAt}`
    );

    model = createLeadModel({
      chats,
      sessionId,
      listingTitleById,
      thresholdHours: settings.thresholdHours,
    });
    render();
    setStatus(`Follow-up queue ready. ${numberFrom(model.summary.dueCount, 0)} due lead(s).`);
    if (schedulerPass) runScheduler({ silent: true });
  };

  refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  schedulerBtn?.addEventListener('click', () => {
    runScheduler({ silent: false });
  });

  csvBtn?.addEventListener('click', exportCsv);

  thresholdEl?.addEventListener('change', () => {
    const hours = Math.max(1, numberFrom(thresholdEl.value, 24));
    setSettings({ thresholdHours: hours });
    refresh().catch((error) => setStatus(text(error?.message, 'Threshold apply failed.'), false));
  });

  queueEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const key = text(target.getAttribute('data-key'));
    if (!action || !key) return;

    const lead = (model.leads || []).find((entry) => entry.key === key);
    if (!lead) return;

    if (action === 'mark-handled') {
      markHandled(lead);
      setStatus('Lead marked as handled.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'snooze') {
      snoozeLead(lead);
      setStatus('Lead snoozed for 24h.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'send-template') {
      sendTemplate(lead)
        .then(() => refresh())
        .catch((error) => setStatus(text(error?.message, 'Follow-up send failed.'), false));
      return;
    }
    if (action === 'open-whatsapp') {
      openWhatsapp(lead).catch((error) => setStatus(text(error?.message, 'WhatsApp handoff failed.'), false));
    }
  });

  refresh({ schedulerPass: true }).catch((error) => {
    setStatus(text(error?.message, 'Unable to load follow-up queue.'), false);
  });
  window.setInterval(() => {
    refresh({ schedulerPass: true }).catch(() => null);
  }, 90000);
})();
