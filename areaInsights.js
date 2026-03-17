(() => {
  const live = window.PropertySetuLive || {};
  const areaSelect = document.getElementById('areaSelect');
  const areaDetails = document.getElementById('areaDetails');
  if (!areaSelect || !areaDetails) return;

  const fallbackData = {
    'Hiran Magri': {
      schools: ['Hiran Magri Public School', 'DAV School'],
      hospitals: ['NIMS Hospital', 'Shri Vardhman Hospital'],
      markets: ['Hiran Magri Market', 'Sector 1 Market'],
      avgPrice: '₹4,500 per sq ft',
    },
    'Pratap Nagar': {
      schools: ['St. Paul School', 'City Public School'],
      hospitals: ['Pratap Nagar Hospital', 'City Hospital'],
      markets: ['Pratap Nagar Market', 'Sector 5 Market'],
      avgPrice: '₹5,000 per sq ft',
    },
    Ambamata: {
      schools: ['Ambamata School', 'Shree School'],
      hospitals: ['Ambamata Hospital', 'Community Health Center'],
      markets: ['Ambamata Market', 'Local Bazaar'],
      avgPrice: '₹3,800 per sq ft',
    },
    Bhuwana: {
      schools: ['Bhuwana School', 'Central School'],
      hospitals: ['Bhuwana Hospital', 'Health Care Center'],
      markets: ['Bhuwana Market', 'Local Shops'],
      avgPrice: '₹4,200 per sq ft',
    },
    Sukher: {
      schools: ['Sukher Public School'],
      hospitals: ['Sukher Hospital'],
      markets: ['Sukher Market', 'Industrial Market'],
      avgPrice: '₹4,000 per sq ft',
    },
    Bedla: {
      schools: ['Bedla School'],
      hospitals: ['Bedla Hospital'],
      markets: ['Bedla Market'],
      avgPrice: '₹3,900 per sq ft',
    },
    Fatehpura: {
      schools: ['Fatehpura School'],
      hospitals: ['Fatehpura Hospital'],
      markets: ['Fatehpura Market'],
      avgPrice: '₹4,100 per sq ft',
    },
  };

  const renderFallback = (name) => {
    const data = fallbackData[name];
    if (!data) {
      areaDetails.innerHTML = '<p>No data available for this area.</p>';
      return;
    }
    areaDetails.innerHTML = `
      <div class="area-card">
        <p><b>Schools:</b> ${data.schools.join(', ')}</p>
        <p><b>Hospitals:</b> ${data.hospitals.join(', ')}</p>
        <p><b>Markets:</b> ${data.markets.join(', ')}</p>
        <p><b>Average Property Price:</b> ${data.avgPrice}</p>
      </div>
    `;
  };

  const renderLive = (payload) => {
    const stats = payload?.stats || {};
    const nearby = payload?.nearby || {};
    const trend = Array.isArray(payload?.trend) ? payload.trend : [];
    const avgPrice = Number(stats.avgPrice || 0).toLocaleString('en-IN');
    const medianPrice = Number(stats.medianPrice || 0).toLocaleString('en-IN');
    const trendText = trend.length
      ? trend.map((item) => `M-${item.monthOffset}: ₹${Number(item.avgRate || 0).toLocaleString('en-IN')}`).join(' | ')
      : 'Trend unavailable';

    areaDetails.innerHTML = `
      <div class="area-card">
        <p><b>Total Listings:</b> ${stats.totalListings || 0}</p>
        <p><b>Approved Listings:</b> ${stats.approvedListings || 0}</p>
        <p><b>Verified Listings:</b> ${stats.verifiedListings || 0}</p>
        <p><b>Average Price:</b> ₹${avgPrice}</p>
        <p><b>Median Price:</b> ₹${medianPrice}</p>
        <p><b>Schools:</b> ${(nearby.schools || []).join(', ') || 'N/A'}</p>
        <p><b>Hospitals:</b> ${(nearby.hospitals || []).join(', ') || 'N/A'}</p>
        <p><b>Markets:</b> ${(nearby.markets || []).join(', ') || 'N/A'}</p>
        <p><b>6-Month Trend:</b> ${trendText}</p>
      </div>
    `;
  };

  areaSelect.addEventListener('change', async () => {
    const val = String(areaSelect.value || '').trim();
    if (!val) {
      areaDetails.innerHTML = '<p>Please select an area to see insights.</p>';
      return;
    }

    if (!live.request) {
      renderFallback(val);
      return;
    }

    try {
      const response = await live.request(`/insights/locality?name=${encodeURIComponent(val)}`);
      renderLive(response);
    } catch {
      renderFallback(val);
    }
  });
})();
