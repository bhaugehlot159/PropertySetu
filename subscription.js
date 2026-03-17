(() => {
  const live = window.PropertySetuLive || {};
  const featuredDiv = document.getElementById('featuredPlans');
  if (!featuredDiv) return;

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  const writeJson = live.writeJson || ((key, value) => localStorage.setItem(key, JSON.stringify(value)));

  const FALLBACK_PLANS = [
    { id: 'featured-7', name: 'Featured Listing - 7 Days', amount: 299, cycleDays: 7, type: 'featured' },
    { id: 'featured-30', name: 'Featured Listing - 30 Days', amount: 999, cycleDays: 30, type: 'featured' },
    { id: 'care-basic', name: 'Property Care Basic Visit', amount: 1500, cycleDays: 30, type: 'care' },
    { id: 'care-plus', name: 'Property Care Plus', amount: 3000, cycleDays: 30, type: 'care' },
    { id: 'care-full', name: 'Property Care Full Maintenance', amount: 5000, cycleDays: 30, type: 'care' },
    { id: 'agent-pro', name: 'Trusted Agent Membership', amount: 1999, cycleDays: 30, type: 'agent' },
  ];

  const formatPrice = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const getToken = () => (live.getAnyToken ? live.getAnyToken() : '');

  const saveLocalSubscription = (record) => {
    const key = 'propertySetu:subscriptions';
    const all = readJson(key, []);
    all.unshift(record);
    writeJson(key, all.slice(0, 80));
  };

  const subscribePlan = async (plan) => {
    const token = getToken();
    let propertyId = '';
    if (plan.type === 'featured') {
      propertyId = String(window.prompt('Featured ke liye Property ID enter karein (optional):', '') || '').trim();
    }

    if (!token || !live.request) {
      saveLocalSubscription({
        ...plan,
        status: 'active',
        propertyId: propertyId || null,
        createdAt: new Date().toISOString(),
        source: 'local-fallback',
      });
      window.alert(`Plan "${plan.name}" local mode me activated (live login required).`);
      return;
    }

    try {
      const response = await live.request('/subscriptions/activate', {
        method: 'POST',
        token,
        data: {
          planId: plan.id,
          ...(propertyId ? { propertyId } : {}),
        },
      });
      saveLocalSubscription({
        ...response.subscription,
        source: 'live',
      });
      window.alert(`Plan "${plan.name}" live activated successfully.`);
    } catch (error) {
      saveLocalSubscription({
        ...plan,
        status: 'pending',
        propertyId: propertyId || null,
        createdAt: new Date().toISOString(),
        source: 'local-fallback-error',
      });
      window.alert(`Live activation failed: ${error.message}. Local backup me request save ho gayi.`);
    }
  };

  const renderPlans = (plans) => {
    featuredDiv.innerHTML = '';
    plans.forEach((plan) => {
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML = `
        <h3>${plan.name} ${plan.type === 'featured' ? '<span class="badge">Featured</span>' : ''}</h3>
        <p><b>Price:</b> ${formatPrice(plan.amount)}</p>
        <p><b>Duration:</b> ${plan.cycleDays} days</p>
        <p><b>Type:</b> ${plan.type}</p>
        <button type="button" data-plan-id="${plan.id}">Subscribe / Activate</button>
      `;
      featuredDiv.appendChild(card);
    });
  };

  const fetchPlans = async () => {
    if (!live.request) return FALLBACK_PLANS;
    try {
      const response = await live.request('/subscriptions/plans');
      const items = Array.isArray(response?.items) && response.items.length ? response.items : FALLBACK_PLANS;
      return items;
    } catch {
      return FALLBACK_PLANS;
    }
  };

  let cachedPlans = FALLBACK_PLANS;

  featuredDiv.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const planId = target.getAttribute('data-plan-id');
    if (!planId) return;
    const plan = cachedPlans.find((item) => item.id === planId);
    if (!plan) return;
    await subscribePlan(plan);
  });

  fetchPlans().then((plans) => {
    cachedPlans = plans;
    renderPlans(plans);
  });
})();
