(() => {
  const live = window.PropertySetuLive || {};
  const areaSelect = document.getElementById('areaSelect');
  const areaDetails = document.getElementById('areaDetails');
  const areaPath = document.getElementById('areaPath');
  const sourceNote = document.getElementById('areaSourceNote');
  const quickAvgPrice = document.getElementById('quickAvgPrice');
  const quickSchoolCount = document.getElementById('quickSchoolCount');
  const quickHospitalCount = document.getElementById('quickHospitalCount');
  const quickMarketCount = document.getElementById('quickMarketCount');
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

  const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const resetQuickStats = () => {
    if (quickAvgPrice) quickAvgPrice.textContent = '-';
    if (quickSchoolCount) quickSchoolCount.textContent = '-';
    if (quickHospitalCount) quickHospitalCount.textContent = '-';
    if (quickMarketCount) quickMarketCount.textContent = '-';
  };

  const setPath = (area) => {
    if (!areaPath) return;
    areaPath.textContent = area ? `Udaipur > ${area}` : 'Udaipur > Select Area';
  };

  const setSource = (text) => {
    if (!sourceNote) return;
    sourceNote.textContent = text;
  };

  const renderFallback = (name) => {
    const data = fallbackData[name];
    if (!data) {
      resetQuickStats();
      areaDetails.innerHTML = '<p>No data available for this area.</p>';
      setSource('Data source: No fallback insight found.');
      return;
    }

    if (quickAvgPrice) quickAvgPrice.textContent = data.avgPrice;
    if (quickSchoolCount) quickSchoolCount.textContent = String(data.schools.length);
    if (quickHospitalCount) quickHospitalCount.textContent = String(data.hospitals.length);
    if (quickMarketCount) quickMarketCount.textContent = String(data.markets.length);

    areaDetails.innerHTML = `
      <div class="area-card">
        <p><b>Area Path:</b> Udaipur > ${name}</p>
        <p><b>Nearby Schools:</b> ${data.schools.join(', ')}</p>
        <p><b>Nearby Hospitals:</b> ${data.hospitals.join(', ')}</p>
        <p><b>Nearby Markets:</b> ${data.markets.join(', ')}</p>
        <p><b>Average Property Price:</b> ${data.avgPrice}</p>
      </div>
    `;
    setSource('Data source: Local fallback area model.');
  };

  const renderLive = (payload, selectedArea) => {
    const stats = payload?.stats || {};
    const nearby = payload?.nearby || {};
    const trend = Array.isArray(payload?.trend) ? payload.trend : [];
    const areaName = String(stats.locality || selectedArea || 'Udaipur');
    const avgPrice = Number(stats.avgPrice || 0);
    const medianPrice = Number(stats.medianPrice || 0);
    const schools = Array.isArray(nearby.schools) ? nearby.schools : [];
    const hospitals = Array.isArray(nearby.hospitals) ? nearby.hospitals : [];
    const markets = Array.isArray(nearby.markets) ? nearby.markets : [];

    if (quickAvgPrice) quickAvgPrice.textContent = `${formatMoney(avgPrice)} avg`;
    if (quickSchoolCount) quickSchoolCount.textContent = String(schools.length);
    if (quickHospitalCount) quickHospitalCount.textContent = String(hospitals.length);
    if (quickMarketCount) quickMarketCount.textContent = String(markets.length);

    const trendText = trend.length
      ? trend.map((item) => `M-${item.monthOffset}: ${formatMoney(item.avgRate)}`).join(' | ')
      : 'Trend unavailable';

    areaDetails.innerHTML = `
      <div class="area-card">
        <p><b>Area Path:</b> Udaipur > ${areaName}</p>
        <p><b>Total Listings:</b> ${stats.totalListings || 0}</p>
        <p><b>Approved Listings:</b> ${stats.approvedListings || 0}</p>
        <p><b>Verified Listings:</b> ${stats.verifiedListings || 0}</p>
        <p><b>Average Property Price:</b> ${formatMoney(avgPrice)}</p>
        <p><b>Median Property Price:</b> ${formatMoney(medianPrice)}</p>
        <p><b>Nearby Schools:</b> ${schools.join(', ') || 'N/A'}</p>
        <p><b>Nearby Hospitals:</b> ${hospitals.join(', ') || 'N/A'}</p>
        <p><b>Nearby Markets:</b> ${markets.join(', ') || 'N/A'}</p>
        <p><b>6-Month Trend:</b> ${trendText}</p>
      </div>
    `;
    setSource('Data source: Live locality insights API.');
  };

  areaSelect.addEventListener('change', async () => {
    const val = String(areaSelect.value || '').trim();
    if (!val) {
      setPath('');
      resetQuickStats();
      setSource('Example: Udaipur > Hiran Magri. Live/local data source yahan show hoga.');
      areaDetails.innerHTML = '<p>Please select an area to see insights.</p>';
      return;
    }

    setPath(val);
    if (!live.request) {
      renderFallback(val);
      return;
    }

    try {
      const response = await live.request(`/insights/locality?name=${encodeURIComponent(val)}`);
      renderLive(response, val);
    } catch {
      renderFallback(val);
    }
  });
})();
