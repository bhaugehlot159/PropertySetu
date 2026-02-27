(() => {
  const canvas = document.getElementById('heroCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const stars = [];

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
    };

    const buildStars = () => {
      stars.length = 0;
      for (let index = 0; index < 140; index += 1) {
        stars.push({
          x: (Math.random() - 0.5) * canvas.width,
          y: (Math.random() - 0.5) * canvas.height,
          z: Math.random() * canvas.width,
        });
      }
    };

    const animate = () => {
      ctx.fillStyle = '#0b2f6b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      stars.forEach((star) => {
        star.z -= 2;
        if (star.z <= 1) star.z = canvas.width;
        const scale = 128 / star.z;
        const px = star.x * scale + canvas.width / 2;
        const py = star.y * scale + canvas.height / 2;
        if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(px, py, 2, 2);
        }
      });
      requestAnimationFrame(animate);
    };

    setCanvasSize();
    buildStars();
    animate();
    window.addEventListener('resize', () => {
      setCanvasSize();
      buildStars();
    });
  }

  const readJsonStorage = (key, fallbackValue) => {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    try {
      return JSON.parse(raw);
    } catch {
      return fallbackValue;
    }
  };

  const writeJsonStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const locations = window.PROPERTYSETU_LOCATIONS || [];
  const citySelect = document.getElementById('citySelect');
  const locationSearch = document.getElementById('locationSearch');
  const locationSuggestions = document.getElementById('locationSuggestions');
  const suggestionList = document.getElementById('suggestionList');
  const slugPreview = document.getElementById('slugPreview');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const searchButton = document.getElementById('searchButton');

  if (locationSuggestions) {
    locationSuggestions.innerHTML = locations.map((loc) => `<option value="${loc}"></option>`).join('');
  }

  citySelect?.addEventListener('change', () => {
    if (slugPreview) slugPreview.textContent = `SEO path preview: propertysetu.in/${citySelect.value}`;
  });

  locationSearch?.addEventListener('input', () => {
    if (!suggestionList) return;
    const value = locationSearch.value.toLowerCase().trim();
    if (value.length < 2) {
      suggestionList.innerHTML = '';
      return;
    }

    const filtered = locations
      .filter((loc) => loc.toLowerCase().includes(value))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(value) ? 0 : 1;
        const bStarts = b.toLowerCase().startsWith(value) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b);
      })
      .slice(0, 25);
    suggestionList.innerHTML = filtered.map((loc) => `<li>${loc}</li>`).join('');
    suggestionList.querySelectorAll('li').forEach((item) => {
      item.addEventListener('click', () => {
        locationSearch.value = item.textContent || '';
        suggestionList.innerHTML = '';
      });
    });
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((tab) => tab.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  searchButton?.addEventListener('click', () => {
    const mode = document.querySelector('.tab-btn.active')?.dataset.mode || 'buy';
    const city = citySelect?.value || 'udaipur';
    const location = locationSearch?.value.trim() || 'all-areas';
    window.location.hash = `search/${city}/${mode}/${location.toLowerCase().replace(/\s+/g, '-')}`;
  });

  const customerAuthButton = document.getElementById('customerAuthButton');
  const adminAuthButton = document.getElementById('adminAuthButton');
  const sessionBadge = document.getElementById('sessionBadge');
  const authModal = document.getElementById('authModal');
  const authModalTitle = document.getElementById('authModalTitle');
  const authModalHint = document.getElementById('authModalHint');
  const authNameInput = document.getElementById('authNameInput');
  const authCancelButton = document.getElementById('authCancelButton');
  const authSubmitButton = document.getElementById('authSubmitButton');
  let authMode = 'customer';

  const getState = (role) => {
    const raw = localStorage.getItem(`propertysetu-${role}-session`);
    return raw ? readJsonStorage(`propertysetu-${role}-session`, null) : null;
  };

  const setState = (role, payload) => {
    if (!payload) {
      localStorage.removeItem(`propertysetu-${role}-session`);
      return;
    }
    writeJsonStorage(`propertysetu-${role}-session`, payload);
  };

  const updateAuthButtons = () => {
    const customerState = getState('customer');
    const adminState = getState('admin');

    if (customerAuthButton) {
      customerAuthButton.textContent = customerState ? `Logout ${customerState.name}` : 'Customer Login';
    }
    if (adminAuthButton) {
      adminAuthButton.textContent = adminState ? `Logout ${adminState.name}` : 'Admin Login';
    }
    if (sessionBadge) {
      if (adminState) {
        sessionBadge.textContent = `Admin: ${adminState.name}`;
      } else if (customerState) {
        sessionBadge.textContent = `Customer: ${customerState.name}`;
      } else {
        sessionBadge.textContent = 'Guest Mode';
      }
    }
  };

  const openAuthModal = (role) => {
    authMode = role;
    if (!authModal || !authModalTitle || !authModalHint || !authNameInput) return;
    authModalTitle.textContent = role === 'admin' ? 'Admin Login' : 'Customer Login';
    authModalHint.textContent = role === 'admin'
      ? 'Enter admin display name to start admin session.'
      : 'Enter customer display name to start customer session.';
    authNameInput.value = '';
    authModal.classList.add('show');
    authModal.setAttribute('aria-hidden', 'false');
    authNameInput.focus();
  };

  const closeAuthModal = () => {
    if (!authModal) return;
    authModal.classList.remove('show');
    authModal.setAttribute('aria-hidden', 'true');
  };

  customerAuthButton?.addEventListener('click', () => {
    const current = getState('customer');
    if (current) {
      setState('customer', null);
      updateAuthButtons();
      return;
    }
    openAuthModal('customer');
  });

  adminAuthButton?.addEventListener('click', () => {
    const current = getState('admin');
    if (current) {
      setState('admin', null);
      updateAuthButtons();
      return;
    }
    openAuthModal('admin');
  });

  authCancelButton?.addEventListener('click', closeAuthModal);

  authSubmitButton?.addEventListener('click', () => {
    const displayName = authNameInput?.value.trim();
    if (!displayName) return;
    setState(authMode, { name: displayName, loggedInAt: new Date().toISOString() });
    closeAuthModal();
    updateAuthButtons();
  });

  authModal?.addEventListener('click', (event) => {
    if (event.target === authModal) closeAuthModal();
  });

  const marketplaceMessage = document.getElementById('marketplaceMessage');
  const wishlistCount = document.getElementById('wishlistCount');
  const compareCount = document.getElementById('compareCount');
  const visitCount = document.getElementById('visitCount');
  const sealedBidCount = document.getElementById('sealedBidCount');
  const revealBidsButton = document.getElementById('revealBidsButton');
  const clearWishlistButton = document.getElementById('clearWishlistButton');
  const clearCompareButton = document.getElementById('clearCompareButton');

  const initialMarketplace = readJsonStorage('propertysetu-marketplace-state', {
    wishlist: [],
    compare: [],
    visits: [],
    bids: [],
  });

  const marketplaceState = {
    wishlist: new Set(initialMarketplace.wishlist || []),
    compare: new Set(initialMarketplace.compare || []),
    visits: initialMarketplace.visits || [],
    bids: initialMarketplace.bids || [],
  };

  const persistMarketplaceState = () => {
    writeJsonStorage('propertysetu-marketplace-state', {
      wishlist: [...marketplaceState.wishlist],
      compare: [...marketplaceState.compare],
      visits: marketplaceState.visits,
      bids: marketplaceState.bids,
    });
  };

  const updateMarketplaceStats = () => {
    if (wishlistCount) wishlistCount.textContent = `${marketplaceState.wishlist.size}`;
    if (compareCount) compareCount.textContent = `${marketplaceState.compare.size}`;
    if (visitCount) visitCount.textContent = `${marketplaceState.visits.length}`;
    if (sealedBidCount) sealedBidCount.textContent = `${marketplaceState.bids.length}`;
  };

  const notify = (message) => {
    if (marketplaceMessage) marketplaceMessage.textContent = message;
  };

  const ensureCustomerSession = () => {
    const customer = getState('customer');
    if (customer) return customer;
    notify('Please login as Customer first to use this feature.');
    openAuthModal('customer');
    return null;
  };

  document.querySelectorAll('.listing-card').forEach((card) => {
    const propertyId = card.dataset.propertyId;
    const title = card.dataset.title || 'Property';

    card.querySelectorAll('.action-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;

        if (!ensureCustomerSession()) return;

        if (action === 'wishlist') {
          if (marketplaceState.wishlist.has(propertyId)) {
            marketplaceState.wishlist.delete(propertyId);
            notify(`${title} removed from wishlist.`);
          } else {
            marketplaceState.wishlist.add(propertyId);
            notify(`${title} saved to wishlist.`);
          }
        }

        if (action === 'compare') {
          if (marketplaceState.compare.has(propertyId)) {
            marketplaceState.compare.delete(propertyId);
            notify(`${title} removed from compare.`);
          } else if (marketplaceState.compare.size >= 3) {
            notify('Compare supports up to 3 properties at once.');
          } else {
            marketplaceState.compare.add(propertyId);
            notify(`${title} added to compare.`);
          }
        }

        if (action === 'visit') {
          marketplaceState.visits.push({ propertyId, at: new Date().toISOString() });
          notify(`Visit request created for ${title}.`);
        }

        if (action === 'bid') {
          const bidValue = window.prompt(`Enter your sealed bid amount for ${title} (₹):`);
          const amount = Number(bidValue);
          if (!bidValue || Number.isNaN(amount) || amount <= 0) {
            notify('Please enter a valid positive bid amount.');
            return;
          }
          marketplaceState.bids.push({ propertyId, title, amount, at: new Date().toISOString() });
          notify(`Sealed bid submitted for ${title}. Only admin can reveal winner.`);
        }

        updateMarketplaceStats();
        persistMarketplaceState();
      });
    });
  });

  clearWishlistButton?.addEventListener('click', () => {
    marketplaceState.wishlist.clear();
    updateMarketplaceStats();
    persistMarketplaceState();
    notify('Wishlist cleared.');
  });

  clearCompareButton?.addEventListener('click', () => {
    marketplaceState.compare.clear();
    updateMarketplaceStats();
    persistMarketplaceState();
    notify('Compare list cleared.');
  });

  revealBidsButton?.addEventListener('click', () => {
    const adminState = getState('admin');
    if (!adminState) {
      notify('Admin login required to reveal winning bid.');
      openAuthModal('admin');
      return;
    }
    if (!marketplaceState.bids.length) {
      notify('No bids available yet.');
      return;
    }

    const winnersByProperty = {};
    marketplaceState.bids.forEach((bid) => {
      if (!winnersByProperty[bid.propertyId] || winnersByProperty[bid.propertyId].amount < bid.amount) {
        winnersByProperty[bid.propertyId] = bid;
      }
    });

    const summary = Object.values(winnersByProperty)
      .map((entry) => `${entry.title}: ₹${entry.amount.toLocaleString('en-IN')}`)
      .join(' | ');

    notify(`Winning sealed bids revealed by ${adminState.name} → ${summary}`);
  });

  const aiPromptInput = document.getElementById('aiPromptInput');
  const aiGenerateButton = document.getElementById('aiGenerateButton');
  const aiOutput = document.getElementById('aiOutput');

  aiGenerateButton?.addEventListener('click', () => {
    const promptText = aiPromptInput?.value.trim();
    if (!promptText) {
      if (aiOutput) aiOutput.textContent = 'Please enter property details to generate description.';
      return;
    }

    if (aiOutput) {
      aiOutput.textContent = `Verified ${promptText}. Includes strong location connectivity, visit-booking support, hidden-bid option, and monthly property-care coverage for absentee owners.`;
    }
  });

  updateMarketplaceStats();
  updateAuthButtons();
})();
