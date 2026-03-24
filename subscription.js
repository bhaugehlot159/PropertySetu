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
    {
      id: 'basic-plan',
      name: 'Basic Subscription',
      amount: 1499,
      cycleDays: 30,
      type: 'subscription',
      highlights: ['Up to 5 active listings', 'Basic support', 'Standard ranking'],
    },
    {
      id: 'pro-plan',
      name: 'Pro Subscription',
      amount: 3999,
      cycleDays: 30,
      type: 'subscription',
      highlights: ['Up to 20 active listings', 'Priority support', 'Seller analytics access'],
    },
    {
      id: 'premium-plan',
      name: 'Premium Subscription',
      amount: 7999,
      cycleDays: 30,
      type: 'subscription',
      highlights: ['Unlimited active listings', 'Top priority support', 'Higher lead boost and concierge support'],
    },
    {
      id: 'verified-badge-charge',
      name: 'Verified Badge Charge',
      amount: 799,
      cycleDays: 30,
      type: 'verification',
      highlights: ['Owner Aadhaar/PAN check', 'Address verification', 'Verified by PropertySetu badge'],
    },
    {
      id: 'care-basic',
      name: 'Property Care Basic Visit',
      amount: 2500,
      cycleDays: 30,
      type: 'care',
      highlights: ['Monthly house check', 'Lock check', 'Water leakage check'],
    },
    {
      id: 'care-plus',
      name: 'Property Care Cleaning + Visit',
      amount: 5500,
      cycleDays: 30,
      type: 'care',
      highlights: ['Everything in Basic', 'Garden maintenance', 'Bill payment handling'],
    },
    {
      id: 'care-full',
      name: 'Property Care Full Maintenance',
      amount: 10000,
      cycleDays: 30,
      type: 'care',
      highlights: ['Priority maintenance', 'Tenant coordination', 'Full monthly owner support'],
    },
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
      const highlights = Array.isArray(plan.highlights) && plan.highlights.length
        ? `<ul>${plan.highlights.map((item) => `<li>${item}</li>`).join('')}</ul>`
        : '';
      const labels = [];
      if (plan.type === 'featured') labels.push('<span class="badge">Featured</span>');
      if (plan.type === 'verification') labels.push('<span class="badge">Verified Badge</span>');
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML = `
        <h3>${plan.name} ${labels.join(' ')}</h3>
        <p><b>Price:</b> ${formatPrice(plan.amount)}</p>
        <p><b>Duration:</b> ${plan.cycleDays} days</p>
        <p><b>Type:</b> ${plan.type}</p>
        ${highlights}
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
