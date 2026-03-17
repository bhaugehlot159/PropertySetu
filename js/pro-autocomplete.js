(() => {
  const escapeHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const highlightMatch = (text, query) => {
    const safeText = escapeHtml(text);
    if (!query) return safeText;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(`(${escapedQuery})`, 'ig');
    return safeText.replace(reg, '<mark class="ps-ac-highlight">$1</mark>');
  };

  const normalizeGroups = () => {
    if (Array.isArray(window.PROPERTYSETU_LOCATION_GROUPS) && window.PROPERTYSETU_LOCATION_GROUPS.length) {
      return window.PROPERTYSETU_LOCATION_GROUPS
        .map((group) => ({
          id: group.id || group.title || 'group',
          title: group.title || 'Udaipur',
          icon: group.icon || '📍',
          items: Array.isArray(group.items) ? [...new Set(group.items.map((item) => String(item || '').trim()).filter(Boolean))] : [],
        }))
        .filter((group) => group.items.length);
    }

    const fallback = Array.isArray(window.PROPERTYSETU_LOCATIONS) ? window.PROPERTYSETU_LOCATIONS : [];
    return [{
      id: 'all',
      title: 'UDAIPUR LOCALITIES',
      icon: '📍',
      items: [...new Set(fallback.map((item) => String(item || '').trim()).filter(Boolean))],
    }];
  };

  const sortByRelevance = (items, query) => {
    if (!query) return items;
    return [...items].sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(query) ? 0 : 1;
      const bStarts = bLower.startsWith(query) ? 0 : 1;
      const aIndex = aLower.indexOf(query);
      const bIndex = bLower.indexOf(query);
      return aStarts - bStarts || aIndex - bIndex || a.localeCompare(b);
    });
  };

  const buildMatches = (groups, rawQuery, maxPerGroup = 8, maxTotal = 64) => {
    const query = String(rawQuery || '').trim().toLowerCase();
    const seen = new Set();
    const bucket = [];
    let total = 0;

    groups.forEach((group) => {
      if (total >= maxTotal) return;
      let matches = group.items;
      if (query) {
        matches = matches.filter((item) => item.toLowerCase().includes(query));
      }
      const dynamicGroupLimit = query.length >= 3 ? Math.max(maxPerGroup, 20) : maxPerGroup;
      const previewLimit = query ? dynamicGroupLimit : Math.min(maxPerGroup, 5);
      matches = sortByRelevance(matches, query).slice(0, previewLimit);
      matches = matches.filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (!matches.length) return;
      total += matches.length;
      bucket.push({
        ...group,
        matches,
      });
    });

    return bucket;
  };

  const attachAutocomplete = (inputId, opts = {}) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.setAttribute('autocomplete', 'off');
    input.removeAttribute('list');

    const parent = input.parentElement;
    if (!parent) return;
    parent.classList.add('ps-ac-wrap');

    const panel = document.createElement('div');
    panel.className = 'ps-autocomplete-panel';
    panel.hidden = true;
    parent.appendChild(panel);

    const groups = normalizeGroups();
    const maxPerGroup = opts.maxPerGroup || 8;
    const maxTotal = opts.maxTotal || 64;
    let activeIndex = -1;
    let optionButtons = [];
    let hideTimer = null;
    let suppressRender = false;

    const closePanel = () => {
      panel.hidden = true;
      panel.classList.remove('show');
      activeIndex = -1;
      optionButtons = [];
    };

    const setActive = (index) => {
      optionButtons.forEach((button, idx) => {
        button.classList.toggle('active', idx === index);
      });
      activeIndex = index;
      const active = optionButtons[activeIndex];
      if (active) {
        active.scrollIntoView({ block: 'nearest' });
      }
    };

    const pickValue = (value) => {
      suppressRender = true;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      suppressRender = false;
      closePanel();
    };

    const renderPanel = () => {
      if (suppressRender) return;
      const query = String(input.value || '').trim();
      const grouped = buildMatches(groups, query, maxPerGroup, maxTotal);

      if (!grouped.length) {
        panel.innerHTML = `
          <div class="ps-ac-empty">
            <strong>No location match</strong>
            <span>Try area names like Hiran Magri, Pratap Nagar, Bhuwana.</span>
          </div>`;
        panel.hidden = false;
        panel.classList.add('show');
        optionButtons = [];
        activeIndex = -1;
        return;
      }

      panel.innerHTML = grouped
        .map((group) => `
          <section class="ps-ac-group">
            <header class="ps-ac-group-title">${group.icon} ${escapeHtml(group.title)}</header>
            ${group.matches.map((item) => `
              <button type="button" class="ps-ac-item" data-ac-value="${escapeHtml(item)}">
                ${highlightMatch(item, query)}
              </button>`).join('')}
          </section>`)
        .join('');

      optionButtons = [...panel.querySelectorAll('.ps-ac-item')];
      optionButtons.forEach((button) => {
        button.addEventListener('mousedown', (event) => {
          event.preventDefault();
        });
        button.addEventListener('click', () => {
          const value = button.getAttribute('data-ac-value') || '';
          pickValue(value);
        });
      });

      panel.hidden = false;
      panel.classList.add('show');
      setActive(-1);
    };

    input.addEventListener('focus', () => {
      if (hideTimer) clearTimeout(hideTimer);
      renderPanel();
    });

    input.addEventListener('input', () => {
      if (hideTimer) clearTimeout(hideTimer);
      renderPanel();
    });

    input.addEventListener('keydown', (event) => {
      if (panel.hidden && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        renderPanel();
      }
      if (panel.hidden) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!optionButtons.length) return;
        const next = activeIndex < optionButtons.length - 1 ? activeIndex + 1 : 0;
        setActive(next);
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!optionButtons.length) return;
        const prev = activeIndex > 0 ? activeIndex - 1 : optionButtons.length - 1;
        setActive(prev);
      }

      if (event.key === 'Enter' && activeIndex >= 0 && optionButtons[activeIndex]) {
        event.preventDefault();
        const value = optionButtons[activeIndex].getAttribute('data-ac-value') || '';
        pickValue(value);
      }

      if (event.key === 'Escape') {
        closePanel();
      }
    });

    input.addEventListener('blur', () => {
      hideTimer = setTimeout(() => {
        closePanel();
      }, 140);
    });

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Node)) return;
      if (parent.contains(event.target)) return;
      closePanel();
    });
  };

  const init = () => {
    attachAutocomplete('quickLocality', { maxPerGroup: 7, maxTotal: 56 });
    attachAutocomplete('marketLocality', { maxPerGroup: 12, maxTotal: 160 });
    attachAutocomplete('location', { maxPerGroup: 14, maxTotal: 220 });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
