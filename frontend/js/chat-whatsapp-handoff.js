(() => {
  if (document.getElementById('psWhatsAppHandoffBtn')) return;

  const live = window.PropertySetuLive || {};
  const chatInput = document.getElementById('chatInput');
  const propertySelect = document.getElementById('propertySelect');
  const chatBox = document.getElementById('chatBox');
  if (!chatInput || !propertySelect || !chatBox) return;

  const HandoffLogKey = 'propertySetu:whatsappHandoffLog';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

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

  const button = document.createElement('button');
  button.id = 'psWhatsAppHandoffBtn';
  button.type = 'button';
  button.textContent = 'WhatsApp Handoff';
  button.style.background = '#1f7a45';
  button.style.marginLeft = '6px';
  chatInput.insertAdjacentElement('afterend', button);

  const status = document.createElement('p');
  status.id = 'psWhatsAppHandoffStatus';
  status.style.margin = '8px 0 0';
  status.style.fontSize = '13px';
  status.style.color = '#1d4f87';
  status.textContent = 'Use WhatsApp Handoff to continue chat without sharing direct number in app.';
  button.insertAdjacentElement('afterend', status);

  const setStatus = (message, ok = true) => {
    status.textContent = message;
    status.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const appendLog = (payload = {}) => {
    const rows = readJson(HandoffLogKey, []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift({
      at: new Date().toISOString(),
      ...payload,
    });
    while (next.length > 100) next.pop();
    writeJson(HandoffLogKey, next);
  };

  const getPropertyContext = () => {
    const selectedOption = propertySelect.selectedOptions?.[0] || null;
    return {
      id: text(propertySelect.value),
      title: text(selectedOption?.textContent || propertySelect.value || 'Property'),
    };
  };

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') {
      return text(live.getToken('customer') || live.getToken('seller') || live.getToken('admin'));
    }
    return '';
  };

  const buildFallbackUrl = (prefilledMessage) => (
    `https://wa.me/?text=${encodeURIComponent(text(prefilledMessage))}`
  );

  const requestViaLive = async ({ propertyId, message, token }) => {
    if (!token || typeof live.request !== 'function') return null;

    try {
      const response = await live.request(
        `/chat/${encodeURIComponent(propertyId)}/whatsapp-link?message=${encodeURIComponent(message)}`,
        { token },
      );
      const url = text(response?.whatsapp?.url);
      if (url) {
        return {
          url,
          source: 'chat-whatsapp-link',
          receiverName: text(response?.whatsapp?.receiverName),
          phoneMasked: text(response?.whatsapp?.phoneMasked),
        };
      }
    } catch {
      // try secondary flow
    }

    try {
      const response = await live.request('/chat/send', {
        method: 'POST',
        token,
        data: {
          propertyId,
          message,
          whatsappHandoff: true,
        },
      });
      const url = text(response?.whatsapp?.url);
      if (url) {
        return {
          url,
          source: 'chat-send-handoff',
          receiverName: text(response?.whatsapp?.receiverName),
          phoneMasked: text(response?.whatsapp?.phoneMasked),
        };
      }
    } catch {
      // handled by fallback below
    }

    return null;
  };

  const openHandoff = async () => {
    const { id: propertyId, title } = getPropertyContext();
    if (!propertyId) {
      setStatus('Please select a property first.', false);
      return;
    }

    const typed = text(chatInput.value);
    const message = typed || `Hi, I am interested in "${title}" on PropertySetu.`;
    const token = getToken();

    const liveResult = await requestViaLive({ propertyId, message, token });
    const url = text(liveResult?.url) || buildFallbackUrl(message);
    const source = text(liveResult?.source, 'fallback-wa');

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      const receiverInfo = liveResult?.receiverName
        ? ` Receiver: ${liveResult.receiverName}${liveResult.phoneMasked ? ` (${liveResult.phoneMasked})` : ''}.`
        : '';
      setStatus(`WhatsApp handoff opened.${receiverInfo}`);
      appendLog({
        propertyId,
        source,
        hasLiveToken: Boolean(token),
      });
    } catch {
      setStatus('Unable to open WhatsApp handoff.', false);
      appendLog({
        propertyId,
        source: `${source}-failed-open`,
        hasLiveToken: Boolean(token),
      });
    }
  };

  button.addEventListener('click', () => {
    openHandoff().catch((error) => {
      setStatus(`WhatsApp handoff failed: ${text(error?.message, 'unknown error')}`, false);
    });
  });
})();
