(() => {
  if (document.getElementById('sellerChatInboxCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const STYLE_ID = 'seller-chat-inbox-style';
  const CARD_ID = 'sellerChatInboxCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const SEEN_KEY = 'propertySetu:sellerChatSeenAt';

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

  const formatDate = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };

  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };

  const conversationKey = (propertyId, counterpartId) => `${propertyId}::${counterpartId}`;

  const getListingTitleById = (id) => {
    const rows = readJson(LISTINGS_KEY, []);
    const item = (Array.isArray(rows) ? rows : []).find((entry) => text(entry?.id) === id);
    return text(item?.title, id);
  };

  const getSeenMap = () => {
    const map = readJson(SEEN_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };

  const setSeen = (key, at) => {
    if (!key || !at) return;
    const map = getSeenMap();
    map[key] = text(at);
    writeJson(SEEN_KEY, map);
  };

  const clearSeen = () => {
    writeJson(SEEN_KEY, {});
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sci-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .sci-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
#${CARD_ID} .sci-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .sci-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .sci-summary { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 10px; }
#${CARD_ID} .sci-kpi { border: 1px solid #d7e5f7; border-radius: 8px; padding: 8px; background: #f8fbff; }
#${CARD_ID} .sci-kpi small { display: block; color: #58718f; }
#${CARD_ID} .sci-kpi b { color: #11466e; font-size: 16px; }
#${CARD_ID} .sci-layout { display: grid; gap: 10px; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); }
#${CARD_ID} .sci-thread-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-height: 420px; overflow: auto; }
#${CARD_ID} .sci-thread { border: 1px solid #dce5f1; border-radius: 8px; padding: 8px; background: #fff; cursor: pointer; }
#${CARD_ID} .sci-thread.active { border-color: #0b3d91; background: #eef4ff; }
#${CARD_ID} .sci-thread-title { font-weight: 700; color: #12395f; display: flex; gap: 6px; align-items: center; justify-content: space-between; }
#${CARD_ID} .sci-thread-meta { margin-top: 4px; color: #4a617b; font-size: 12px; line-height: 1.35; }
#${CARD_ID} .sci-unread { border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 700; background: #ffe9e9; color: #8f1f1f; }
#${CARD_ID} .sci-panel { border: 1px solid #dce5f1; border-radius: 10px; padding: 8px; background: #fff; display: grid; gap: 8px; }
#${CARD_ID} .sci-chat { border: 1px solid #dae6fb; border-radius: 8px; background: #f8fbff; padding: 8px; min-height: 220px; max-height: 340px; overflow: auto; }
#${CARD_ID} .sci-msg { margin: 0 0 8px; padding: 7px 9px; border-radius: 8px; border: 1px solid #d4e2f7; background: #fff; }
#${CARD_ID} .sci-msg.mine { background: #e9f7ef; border-color: #cfead8; }
#${CARD_ID} .sci-msg-meta { color: #5a7492; font-size: 11px; margin-bottom: 4px; }
#${CARD_ID} .sci-input { width: 100%; border: 1px solid #cad9ef; border-radius: 8px; padding: 8px 10px; }
#${CARD_ID} .sci-compose-meta { margin: 0; color: #4a617b; font-size: 12px; }
@media (max-width: 900px) {
  #${CARD_ID} .sci-layout { grid-template-columns: 1fr; }
}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Buyer Inquiry Chat Inbox</h2>
    <p id="sciStatus" class="sci-status">Loading chat threads...</p>
    <div class="sci-toolbar">
      <button id="sciRefreshBtn" class="sci-btn" type="button">Refresh Inbox</button>
      <button id="sciClearSeenBtn" class="sci-btn alt" type="button">Clear Seen Marks</button>
    </div>
    <div id="sciSummary" class="sci-summary"></div>
    <div class="sci-layout">
      <ul id="sciThreadList" class="sci-thread-list"><li class="sci-thread">No threads yet.</li></ul>
      <section class="sci-panel">
        <h3 id="sciConversationTitle" style="margin:0;color:#11466e;">Select a thread</h3>
        <div id="sciMessageList" class="sci-chat"><p style="margin:0;color:#607da8;">No conversation selected.</p></div>
        <p id="sciComposeMeta" class="sci-compose-meta">Property: - | Counterparty: -</p>
        <textarea id="sciMessageInput" class="sci-input" rows="3" placeholder="Type reply message"></textarea>
        <div class="sci-toolbar">
          <button id="sciSendBtn" class="sci-btn" type="button">Send Reply</button>
          <button id="sciRefreshConversationBtn" class="sci-btn alt" type="button">Refresh Conversation</button>
          <button id="sciWhatsappBtn" class="sci-btn alt" type="button">WhatsApp Handoff</button>
        </div>
      </section>
    </div>
  `;

  const containers = Array.from(document.querySelectorAll('.container'));
  const anchor = containers[1] || containers[containers.length - 1];
  if (anchor) {
    anchor.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('sciStatus');
  const summaryEl = document.getElementById('sciSummary');
  const threadListEl = document.getElementById('sciThreadList');
  const conversationTitleEl = document.getElementById('sciConversationTitle');
  const messageListEl = document.getElementById('sciMessageList');
  const composeMetaEl = document.getElementById('sciComposeMeta');
  const messageInputEl = document.getElementById('sciMessageInput');
  const refreshBtn = document.getElementById('sciRefreshBtn');
  const clearSeenBtn = document.getElementById('sciClearSeenBtn');
  const sendBtn = document.getElementById('sciSendBtn');
  const refreshConversationBtn = document.getElementById('sciRefreshConversationBtn');
  const whatsappBtn = document.getElementById('sciWhatsappBtn');

  let threads = [];
  let activeThreadKey = '';
  let autoRefreshTimer = null;

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const buildThreads = (items = []) => {
    const sessionId = getSessionId();
    const seenMap = getSeenMap();
    const grouped = new Map();

    (Array.isArray(items) ? items : []).forEach((item) => {
      const senderId = text(item?.senderId);
      const receiverId = text(item?.receiverId);
      const propertyId = text(item?.propertyId);
      const createdAt = text(item?.createdAt);
      if (!sessionId || !propertyId) return;
      if (senderId !== sessionId && receiverId !== sessionId) return;
      const counterpartId = senderId === sessionId ? receiverId : senderId;
      if (!counterpartId) return;
      const key = conversationKey(propertyId, counterpartId);
      const existing = grouped.get(key) || {
        key,
        propertyId,
        counterpartId,
        propertyTitle: getListingTitleById(propertyId),
        totalMessages: 0,
        unreadMessages: 0,
        lastMessage: '',
        lastAt: '',
      };
      existing.totalMessages += 1;
      if (createdAt && (!existing.lastAt || new Date(createdAt).getTime() > new Date(existing.lastAt).getTime())) {
        existing.lastAt = createdAt;
        existing.lastMessage = text(item?.message);
      }
      const seenAt = text(seenMap[key]);
      if (receiverId === sessionId && createdAt && (!seenAt || new Date(createdAt).getTime() > new Date(seenAt).getTime())) {
        existing.unreadMessages += 1;
      }
      grouped.set(key, existing);
    });

    return [...grouped.values()]
      .sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime());
  };

  const renderSummary = () => {
    const totals = threads.reduce((acc, row) => {
      acc.unread += numberFrom(row.unreadMessages, 0);
      acc.messages += numberFrom(row.totalMessages, 0);
      return acc;
    }, { unread: 0, messages: 0 });
    summaryEl.innerHTML = `
      <div class="sci-kpi"><small>Threads</small><b>${threads.length}</b></div>
      <div class="sci-kpi"><small>Unread</small><b>${totals.unread}</b></div>
      <div class="sci-kpi"><small>Total Messages</small><b>${totals.messages}</b></div>
    `;
  };

  const renderThreadList = () => {
    if (!threads.length) {
      threadListEl.innerHTML = '<li class="sci-thread">No chat threads found.</li>';
      return;
    }
    threadListEl.innerHTML = threads.map((row) => `
      <li class="sci-thread ${row.key === activeThreadKey ? 'active' : ''}" data-thread-key="${escapeHtml(row.key)}">
        <div class="sci-thread-title">
          <span>${escapeHtml(row.propertyTitle)}</span>
          ${row.unreadMessages > 0 ? `<span class="sci-unread">${row.unreadMessages}</span>` : ''}
        </div>
        <div class="sci-thread-meta">Counterparty: ${escapeHtml(row.counterpartId)}</div>
        <div class="sci-thread-meta">${escapeHtml(row.lastMessage || '-')}</div>
        <div class="sci-thread-meta">${escapeHtml(formatDate(row.lastAt))}</div>
      </li>
    `).join('');
  };

  const getActiveThread = () => threads.find((row) => row.key === activeThreadKey) || null;

  const renderConversation = (messages = []) => {
    const active = getActiveThread();
    const sessionId = getSessionId();
    if (!active) {
      conversationTitleEl.textContent = 'Select a thread';
      composeMetaEl.textContent = 'Property: - | Counterparty: -';
      messageListEl.innerHTML = '<p style="margin:0;color:#607da8;">No conversation selected.</p>';
      return;
    }

    conversationTitleEl.textContent = `${active.propertyTitle} • ${active.counterpartId}`;
    composeMetaEl.textContent = `Property: ${active.propertyId} | Counterparty: ${active.counterpartId}`;

    const list = (Array.isArray(messages) ? messages : [])
      .filter((item) => {
        const senderId = text(item?.senderId);
        const receiverId = text(item?.receiverId);
        const propertyId = text(item?.propertyId);
        return propertyId === active.propertyId && (
          (senderId === sessionId && receiverId === active.counterpartId)
          || (senderId === active.counterpartId && receiverId === sessionId)
        );
      })
      .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());

    if (!list.length) {
      messageListEl.innerHTML = '<p style="margin:0;color:#607da8;">No messages in this thread.</p>';
      return;
    }

    messageListEl.innerHTML = list.map((item) => {
      const mine = text(item?.senderId) === sessionId;
      return `
        <div class="sci-msg ${mine ? 'mine' : ''}">
          <div class="sci-msg-meta">${mine ? 'You' : 'Buyer'} • ${escapeHtml(formatDate(item?.createdAt))}</div>
          <div>${escapeHtml(text(item?.message))}</div>
        </div>
      `;
    }).join('');
    messageListEl.scrollTop = messageListEl.scrollHeight;

    const lastIncoming = [...list]
      .reverse()
      .find((item) => text(item?.receiverId) === sessionId);
    if (lastIncoming?.createdAt) {
      setSeen(active.key, text(lastIncoming.createdAt));
    }
  };

  const loadInbox = async (preserveActive = true) => {
    const token = getToken();
    if (!token || typeof live.request !== 'function') {
      threads = [];
      activeThreadKey = '';
      renderSummary();
      renderThreadList();
      renderConversation([]);
      setStatus('Seller login required for live chat inbox.', false);
      return;
    }

    try {
      const response = await live.request('/chat/mine', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      const nextThreads = buildThreads(items);
      const previousKey = activeThreadKey;
      threads = nextThreads;
      if (preserveActive && previousKey && nextThreads.some((row) => row.key === previousKey)) {
        activeThreadKey = previousKey;
      } else {
        activeThreadKey = nextThreads[0]?.key || '';
      }
      renderSummary();
      renderThreadList();
      renderConversation(items);
      setStatus('Inbox refreshed.');
    } catch (error) {
      setStatus(`Inbox refresh failed: ${text(error?.message, 'unknown error')}`, false);
    }
  };

  const refreshConversation = async () => {
    const token = getToken();
    const active = getActiveThread();
    if (!token || !active || typeof live.request !== 'function') {
      renderConversation([]);
      return;
    }
    try {
      const response = await live.request(`/chat/${encodeURIComponent(active.propertyId)}?limit=200`, { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      renderConversation(items);
      await loadInbox(true);
    } catch (error) {
      setStatus(`Conversation refresh failed: ${text(error?.message, 'unknown error')}`, false);
    }
  };

  const sendReply = async () => {
    const token = getToken();
    const active = getActiveThread();
    const message = text(messageInputEl.value);
    if (!token || typeof live.request !== 'function') {
      setStatus('Login required to send reply.', false);
      return;
    }
    if (!active) {
      setStatus('Select a thread before sending message.', false);
      return;
    }
    if (!message) {
      setStatus('Message cannot be empty.', false);
      return;
    }

    try {
      await live.request('/chat/send', {
        method: 'POST',
        token,
        data: {
          propertyId: active.propertyId,
          receiverId: active.counterpartId,
          message,
        },
      });
      messageInputEl.value = '';
      setStatus('Reply sent.');
      await refreshConversation();
    } catch (error) {
      setStatus(`Reply failed: ${text(error?.message, 'unknown error')}`, false);
    }
  };

  const openWhatsapp = async () => {
    const token = getToken();
    const active = getActiveThread();
    if (!token || typeof live.request !== 'function') {
      setStatus('Login required for WhatsApp handoff.', false);
      return;
    }
    if (!active) {
      setStatus('Select a thread first.', false);
      return;
    }

    try {
      const response = await live.request(`/chat/${encodeURIComponent(active.propertyId)}/whatsapp-link?receiverId=${encodeURIComponent(active.counterpartId)}`, { token });
      const url = text(response?.whatsapp?.url);
      if (!url) {
        setStatus('WhatsApp link unavailable for this conversation.', false);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      setStatus('WhatsApp handoff opened.');
    } catch (error) {
      setStatus(`WhatsApp handoff failed: ${text(error?.message, 'unknown error')}`, false);
    }
  };

  threadListEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest('[data-thread-key]');
    if (!(row instanceof HTMLElement)) return;
    const key = text(row.getAttribute('data-thread-key'));
    if (!key) return;
    activeThreadKey = key;
    loadInbox(true).catch((error) => setStatus(`Thread load failed: ${text(error?.message, 'unknown error')}`, false));
  });

  refreshBtn?.addEventListener('click', () => {
    loadInbox(true).catch((error) => setStatus(`Inbox refresh failed: ${text(error?.message, 'unknown error')}`, false));
  });

  clearSeenBtn?.addEventListener('click', () => {
    clearSeen();
    loadInbox(true).catch((error) => setStatus(`Seen reset failed: ${text(error?.message, 'unknown error')}`, false));
  });

  sendBtn?.addEventListener('click', () => {
    sendReply().catch((error) => setStatus(`Send failed: ${text(error?.message, 'unknown error')}`, false));
  });

  refreshConversationBtn?.addEventListener('click', () => {
    refreshConversation().catch((error) => setStatus(`Conversation refresh failed: ${text(error?.message, 'unknown error')}`, false));
  });

  whatsappBtn?.addEventListener('click', () => {
    openWhatsapp().catch((error) => setStatus(`WhatsApp failed: ${text(error?.message, 'unknown error')}`, false));
  });

  loadInbox(true).catch((error) => setStatus(`Inbox init failed: ${text(error?.message, 'unknown error')}`, false));
  autoRefreshTimer = window.setInterval(() => {
    loadInbox(true).catch(() => {
      // ignore periodic refresh errors
    });
  }, 30000);

  window.addEventListener('beforeunload', () => {
    if (autoRefreshTimer) window.clearInterval(autoRefreshTimer);
  });
})();
