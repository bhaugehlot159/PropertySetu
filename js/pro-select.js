(() => {
  const targetIds = ['quickPurpose', 'marketCategory', 'marketPurpose', 'marketSort', 'marketVerifiedOnly'];
  const instances = [];

  const closeAll = (exceptWrap = null) => {
    instances.forEach((instance) => {
      if (instance.wrap === exceptWrap) return;
      instance.close();
    });
  };

  const enhanceSelect = (selectId) => {
    const select = document.getElementById(selectId);
    if (!select || select.dataset.psEnhanced === '1') return;

    const options = [...select.options].filter((opt) => !opt.disabled && String(opt.value || '').trim() !== '');
    if (!options.length) return;

    select.dataset.psEnhanced = '1';

    const parent = select.parentElement;
    if (!parent) return;

    const wrap = document.createElement('div');
    wrap.className = 'ps-select-wrap';
    parent.insertBefore(wrap, select);
    wrap.appendChild(select);

    select.classList.add('ps-native-select');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ps-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    wrap.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'ps-select-panel';
    panel.setAttribute('role', 'listbox');
    wrap.appendChild(panel);

    let optionButtons = [];

    const close = () => {
      wrap.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    const open = () => {
      closeAll(wrap);
      wrap.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const renderOptions = () => {
      panel.innerHTML = options.map((opt) => `
        <button type="button" class="ps-select-option" data-value="${String(opt.value).replace(/"/g, '&quot;')}">
          ${String(opt.textContent || '').trim()}
        </button>
      `).join('');

      optionButtons = [...panel.querySelectorAll('.ps-select-option')];
      optionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const value = btn.getAttribute('data-value') || '';
          if (select.value !== value) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
          }
          syncTrigger();
          close();
        });
      });
    };

    const syncTrigger = () => {
      const selected = select.options[select.selectedIndex];
      const label = selected ? String(selected.textContent || '').trim() : '';
      trigger.textContent = label || 'Select option';
      optionButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-value') === String(select.value));
      });
    };

    trigger.addEventListener('click', () => {
      if (wrap.classList.contains('open')) close();
      else open();
    });

    wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close();
      }
    });

    select.addEventListener('change', syncTrigger);
    select.addEventListener('input', syncTrigger);

    instances.push({ wrap, close, sync: syncTrigger });
    renderOptions();
    syncTrigger();
  };

  const syncAll = () => {
    instances.forEach((instance) => instance.sync());
  };

  const init = () => {
    targetIds.forEach(enhanceSelect);

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Node)) return;
      const inside = instances.some((instance) => instance.wrap.contains(event.target));
      if (!inside) closeAll();
    });

    const quickSearchButton = document.getElementById('quickSearchButton');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    quickSearchButton?.addEventListener('click', () => setTimeout(syncAll, 0));
    resetFiltersBtn?.addEventListener('click', () => setTimeout(syncAll, 0));

    setInterval(syncAll, 400);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
