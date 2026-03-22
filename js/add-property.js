(() => {
  const live = window.PropertySetuLive || {};
  const form = document.getElementById('addPropertyForm');
  const photosInput = document.getElementById('photos');
  const videoInput = document.getElementById('video');
  const photoPreview = document.getElementById('photoPreview');
  const videoPreview = document.getElementById('videoPreview');
  const statusArea = document.getElementById('statusArea');
  const payloadPreview = document.getElementById('payloadPreview');
  const saveDraftBtn = document.getElementById('saveDraft');
  const clearDraftBtn = document.getElementById('clearDraft');
  const citySelect = document.getElementById('city');
  const priceSuggestionOutput = document.getElementById('priceSuggestionOutput');
  const getPriceSuggestionBtn = document.getElementById('getPriceSuggestionBtn');
  const generateAiDescriptionBtn = document.getElementById('generateAiDescriptionBtn');
  const videoVisitStatus = document.getElementById('videoVisitStatus');
  const trustModelPreview = document.getElementById('trustModelPreview');
  const ownerStatusSelect = document.getElementById('ownerAadhaarPanStatus');
  const addressStatusSelect = document.getElementById('addressVerificationStatus');
  const documentsInput = document.getElementById('documents');
  const ownerIdProofInput = document.getElementById('ownerIdProof');
  const addressProofInput = document.getElementById('addressProof');
  let videoDurationSeconds = 0;

  const DRAFT_KEY = 'propertySetu:addPropertyDraft';
  const LISTINGS_KEY = 'propertySetu:listings';
  const OFFLINE_LOCALITY_PRICE_MODEL = {
    'hiran magri': 6200000,
    pratap: 5400000,
    bhuwana: 6900000,
    sukher: 7600000,
    ambamata: 8800000,
    savina: 5100000,
    bedla: 5800000,
    '100 feet': 8300000,
    'fatehpura': 7000000,
    'old city': 6500000,
    udaipur: 6000000,
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
    localStorage.setItem(key, JSON.stringify(value));
  });

  const pushNotification = (message, audience = ['all'], title = 'PropertySetu Update', type = 'info') => {
    if (!message) return;
    const notifyApi = window.PropertySetuNotify;
    if (notifyApi && typeof notifyApi.emit === 'function') {
      notifyApi.emit({ title, message, audience, type });
      return;
    }
    const existing = readJson('propertySetu:notifications', []);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      audience: Array.isArray(audience) ? audience : ['all'],
      type,
      createdAt: new Date().toISOString(),
      readBy: {},
    });
    while (list.length > 400) list.pop();
    writeJson('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const text = (value) => String(value || '').trim();
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const medianOf = (arr) => {
    const values = (arr || []).map((x) => numberFrom(x, 0)).filter((x) => x > 0).sort((a, b) => a - b);
    if (!values.length) return 0;
    const mid = Math.floor(values.length / 2);
    if (values.length % 2 === 0) return Math.round((values[mid - 1] + values[mid]) / 2);
    return values[mid];
  };

  const getOfflinePriceBase = (locality) => {
    const q = text(locality).toLowerCase();
    const hit = Object.entries(OFFLINE_LOCALITY_PRICE_MODEL).find(([key]) => q.includes(key));
    return numberFrom(hit?.[1], OFFLINE_LOCALITY_PRICE_MODEL.udaipur);
  };

  const getLocalSmartPricingStats = (localityInput) => {
    const locality = text(localityInput) || 'Udaipur';
    const all = readJson(LISTINGS_KEY, []);
    const udaipurListings = (Array.isArray(all) ? all : []).filter((item) =>
      String(item?.city || 'Udaipur').toLowerCase().includes('udaipur')
    );
    const q = locality.toLowerCase();
    const matches = udaipurListings.filter((item) =>
      `${item?.location || ''} ${item?.locality || ''}`.toLowerCase().includes(q)
    );
    const sourceSet = matches.length ? matches : udaipurListings;
    const prices = sourceSet.map((item) => numberFrom(item?.price, 0)).filter((value) => value > 0);
    const avgFromData = prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0;
    const medianFromData = medianOf(prices);
    const fallbackBase = getOfflinePriceBase(locality);
    const avgPrice = avgFromData || fallbackBase;
    const medianPrice = medianFromData || avgPrice;
    return {
      locality,
      totalListings: matches.length || sourceSet.length || 0,
      avgPrice,
      medianPrice,
      source: prices.length ? 'local-listing-model' : 'udaipur-baseline-model',
    };
  };

  const buildSmartPricingMessage = (stats, sourceText) => {
    const avg = numberFrom(stats?.avgPrice, 0);
    const med = numberFrom(stats?.medianPrice, 0);
    const rec = Math.round((avg + med) / 2 || avg || med || 0);
    return {
      rec,
      text: [
        `Locality: ${stats?.locality || 'Udaipur'}`,
        `Is area me average price ₹${avg.toLocaleString('en-IN')} hai.`,
        `Median price: ₹${med.toLocaleString('en-IN')}`,
        `Suggested price anchor: ₹${rec.toLocaleString('en-IN')}`,
        `Data source: ${sourceText}`,
        `Total matched listings: ${numberFrom(stats?.totalListings, 0)}`,
      ].join('\n'),
    };
  };

  const showStatus = (message, ok = true) => {
    if (!statusArea) return;
    statusArea.innerHTML = `<div class="status-box ${ok ? 'ok' : 'err'}">${message}</div>`;
  };

  const listFileNames = (fileList) => Array.from(fileList || []).map((file) => file.name);
  const hasStatusSubmitted = (value) => ['submitted', 'verified', 'approved'].includes(text(value).toLowerCase());

  const renderVideoVisitStatus = () => {
    if (!videoVisitStatus) return;
    const hasVideo = Boolean(videoInput?.files?.[0]);
    if (!hasVideo) {
      videoVisitStatus.className = 'status-box err';
      videoVisitStatus.textContent = 'Upload seller video (minimum 30 sec) to enable virtual + live video visit.';
      return;
    }
    if (videoDurationSeconds >= 30) {
      videoVisitStatus.className = 'status-box ok';
      videoVisitStatus.textContent = `Video ready (${Math.round(videoDurationSeconds)} sec). Virtual tour + live video visit booking enabled.`;
      return;
    }
    videoVisitStatus.className = 'status-box err';
    videoVisitStatus.textContent = `Video too short (${Math.round(videoDurationSeconds || 0)} sec). Minimum 30 sec required.`;
  };

  const readVideoDuration = (file) => new Promise((resolve) => {
    if (!file) {
      resolve(0);
      return;
    }
    const probe = document.createElement('video');
    const blobUrl = URL.createObjectURL(file);
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const duration = Number(probe.duration || 0);
      URL.revokeObjectURL(blobUrl);
      resolve(Number.isFinite(duration) ? duration : 0);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(0);
    };
    probe.src = blobUrl;
  });

  const getTrustModel = (values) => {
    const propertyDocuments = listFileNames(documentsInput?.files);
    const ownerIdProof = listFileNames(ownerIdProofInput?.files)[0] || null;
    const addressProof = listFileNames(addressProofInput?.files)[0] || null;
    const ownerStatusOk = hasStatusSubmitted(values.ownerAadhaarPanStatus);
    const addressStatusOk = hasStatusSubmitted(values.addressVerificationStatus);
    const docsReady = propertyDocuments.length > 0 && Boolean(ownerIdProof) && Boolean(addressProof);
    const badgeEligible = ownerStatusOk && addressStatusOk && docsReady;
    return {
      ownerStatusOk,
      addressStatusOk,
      docsReady,
      badgeEligible,
      badgeLabel: badgeEligible ? 'Verified by PropertySetu' : 'Verification Pending',
      privateViewMode: values.privateDocsConsent || 'Private View Only',
      ownerKycRef: values.ownerKycRef || null,
      propertyAddressRef: values.propertyAddressRef || null,
      verificationOfficerNote: values.verificationOfficerNote || null,
      propertyDocuments,
      ownerIdProof,
      addressProof,
      score: [ownerStatusOk, addressStatusOk, docsReady].filter(Boolean).length * 34,
    };
  };

  const renderTrustModelPreview = () => {
    if (!trustModelPreview) return;
    const values = getFormValues();
    const trustModel = getTrustModel(values);
    if (trustModel.badgeEligible) {
      trustModelPreview.className = 'status-box ok';
      trustModelPreview.textContent = 'Trust Model Ready: Verified by PropertySetu badge eligible. Owner KYC + address + private docs complete.';
      return;
    }

    const misses = [];
    if (!trustModel.ownerStatusOk) misses.push('Owner Aadhaar/PAN status');
    if (!trustModel.addressStatusOk) misses.push('Address verification status');
    if (!trustModel.docsReady) misses.push('Private documents pack');
    trustModelPreview.className = 'status-box err';
    trustModelPreview.textContent = `Verification pending: ${misses.join(', ')} required for "Verified by PropertySetu" badge.`;
  };

  const forceUdaipurCity = () => {
    if (!citySelect) return;
    citySelect.value = 'Udaipur';
    citySelect.disabled = true;
  };

  const getFormValues = () => {
    const get = (id) => text(document.getElementById(id)?.value);
    return {
      title: get('title'),
      city: 'Udaipur',
      type: get('type'),
      category: get('category'),
      location: get('location'),
      price: numberFrom(get('price'), 0),
      negotiable: get('negotiable'),
      description: get('description'),
      plotSize: get('plotSize'),
      builtUpArea: get('builtUpArea'),
      carpetArea: get('carpetArea'),
      floors: get('floors'),
      facing: get('facing'),
      furnished: get('furnished'),
      bedrooms: numberFrom(get('bedrooms'), 0),
      bathrooms: numberFrom(get('bathrooms'), 0),
      parking: get('parking'),
      garden: get('garden'),
      borewell: get('borewell'),
      roadWidth: numberFrom(get('roadWidth'), 0),
      loanAvailable: get('loanAvailable'),
      readyToMove: get('readyToMove'),
      landmark: get('landmark'),
      virtualTourSlot: get('virtualTourSlot'),
      liveVisitSlot: get('liveVisitSlot'),
      virtualTourOption: get('virtualTourOption'),
      liveVideoVisitSlot: get('liveVideoVisitSlot'),
      ownerAadhaarPanStatus: get('ownerAadhaarPanStatus'),
      addressVerificationStatus: get('addressVerificationStatus'),
      ownerKycRef: get('ownerKycRef'),
      propertyAddressRef: get('propertyAddressRef'),
      verificationOfficerNote: get('verificationOfficerNote'),
      privateDocsConsent: get('privateDocsConsent'),
    };
  };

  const createPhotoPreview = () => {
    if (!photoPreview || !photosInput) return;
    photoPreview.innerHTML = '';
    Array.from(photosInput.files || []).forEach((file) => {
      const image = document.createElement('img');
      image.src = URL.createObjectURL(file);
      image.alt = file.name;
      photoPreview.appendChild(image);
    });
  };

  const createVideoPreview = async () => {
    if (!videoPreview || !videoInput) return;
    videoPreview.innerHTML = '';
    const file = videoInput.files?.[0];
    if (!file) {
      videoDurationSeconds = 0;
      renderVideoVisitStatus();
      return;
    }
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.controls = true;
    videoPreview.appendChild(video);
    videoDurationSeconds = await readVideoDuration(file);
    renderVideoVisitStatus();
  };

  const getAiRiskSignals = (values, photoCount) => {
    const riskyWords = ['urgent sale', 'cash only', 'advance first', 'no visit'];
    const raw = `${values.title} ${values.description}`.toLowerCase();
    const badWords = riskyWords.filter((word) => raw.includes(word));
    const suspiciousPrice = values.price > 0 && values.price < 300000;
    const lowMediaProof = photoCount < 5;

    const riskScore = badWords.length * 30 + (suspiciousPrice ? 30 : 0) + (lowMediaProof ? 40 : 0);
    return {
      riskScore: Math.min(riskScore, 100),
      reasons: [
        ...badWords.map((word) => `Contains risky phrase: "${word}"`),
        ...(suspiciousPrice ? ['Price looks abnormally low for local market'] : []),
        ...(lowMediaProof ? ['Not enough photos for verification'] : []),
      ],
    };
  };

  const renderPayloadPreview = (payload) => {
    if (payloadPreview) payloadPreview.textContent = JSON.stringify(payload, null, 2);
  };

  const generateAiDescription = () => {
    const values = getFormValues();
    if (!values.title || !values.location || !values.price) {
      showStatus('AI description ke liye title, location aur price bharna zaruri hai.', false);
      return;
    }

    const description = [
      `${values.title} in ${values.location}, Udaipur.`,
      `${values.category || 'Property'} available for ${values.type || 'Buy'} at ₹${Number(values.price || 0).toLocaleString('en-IN')}.`,
      values.plotSize ? `Plot size: ${values.plotSize}.` : '',
      values.builtUpArea ? `Built-up area: ${values.builtUpArea}.` : '',
      values.carpetArea ? `Carpet area: ${values.carpetArea}.` : '',
      values.furnished ? `Furnishing: ${values.furnished}.` : '',
      values.bedrooms ? `Bedrooms: ${values.bedrooms}.` : '',
      values.bathrooms ? `Bathrooms: ${values.bathrooms}.` : '',
      values.parking ? `Parking: ${values.parking}.` : '',
      values.landmark ? `Nearby landmark: ${values.landmark}.` : '',
      'Verified documentation flow enabled with PropertySetu private checks.',
    ].filter(Boolean).join(' ');

    const descriptionField = document.getElementById('description');
    if (descriptionField) descriptionField.value = description;
    showStatus('AI description generated and added in description field.', true);
  };

  const getSmartPricing = async () => {
    const locality = text(document.getElementById('localityInsight')?.value) || text(document.getElementById('location')?.value) || 'Udaipur';
    const setSuggestion = (stats, sourceText, statusMsg, ok = true) => {
      const compiled = buildSmartPricingMessage(stats, sourceText);
      if (priceSuggestionOutput) priceSuggestionOutput.value = compiled.text;
      const priceInput = document.getElementById('price');
      if (priceInput && !Number(priceInput.value || 0) && compiled.rec > 0) {
        priceInput.value = String(compiled.rec);
      }
      showStatus(statusMsg, ok);
    };

    if (!live.request) {
      const offlineStats = getLocalSmartPricingStats(locality);
      setSuggestion(
        offlineStats,
        offlineStats.source === 'local-listing-model' ? 'Local listing data (offline mode)' : 'Udaipur baseline smart model (offline mode)',
        'Smart pricing suggestion loaded (offline mode).',
        true
      );
      return;
    }

    try {
      const response = await live.request(`/insights/locality?name=${encodeURIComponent(locality)}`);
      const stats = response?.stats || {};
      setSuggestion(
        {
          locality: stats.locality || locality,
          totalListings: stats.totalListings || 0,
          avgPrice: stats.avgPrice || 0,
          medianPrice: stats.medianPrice || 0,
        },
        'Live locality insights API',
        'Smart pricing suggestion loaded (live mode).',
        true
      );
    } catch (error) {
      const offlineStats = getLocalSmartPricingStats(locality);
      setSuggestion(
        offlineStats,
        offlineStats.source === 'local-listing-model' ? 'Local listing data fallback' : 'Udaipur baseline smart model fallback',
        `Live fetch failed, fallback loaded: ${error.message}`,
        false
      );
    }
  };

  const saveDraft = () => {
    const draft = getFormValues();
    writeJson(DRAFT_KEY, draft);
    showStatus('Draft saved successfully.', true);
    pushNotification(
      `Draft saved for "${draft.title || 'Untitled Property'}" in Udaipur.`,
      ['customer', 'seller'],
      'Draft Saved',
      'info',
    );
  };

  const loadDraft = () => {
    if (!form) return;
    const draft = readJson(DRAFT_KEY, null);
    if (!draft) return;

    Object.entries(draft).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (element && typeof value !== 'object' && value !== null && value !== undefined) {
        element.value = String(value);
      }
    });
    forceUdaipurCity();
    showStatus('Saved draft restored. Re-upload files before submitting.', true);
  };

  const upsertLocalListing = (payload) => {
    if (!payload?.id) return;
    const existing = readJson(LISTINGS_KEY, []);
    const merged = [payload, ...existing.filter((item) => item?.id !== payload.id)];
    writeJson(LISTINGS_KEY, merged);
  };

  const normalizeLocalListing = (payload) => ({
    ...payload,
    locality: payload.location || 'Udaipur',
    purpose: (live.normalizePurpose || ((value) => value || 'Buy'))(payload.type),
    areaSqft: numberFrom(payload.builtUpArea || payload.plotSize || payload.carpetArea, 0),
    beds: numberFrom(payload.bedrooms, 0),
    listedAt: payload.createdAt || new Date().toISOString(),
    image: payload.image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    verifiedByPropertySetu: Boolean(payload.verifiedByPropertySetu || payload?.verification?.badgeEligible),
    verified: Boolean(payload.status === 'Approved' || payload.verifiedByPropertySetu || payload?.verification?.badgeEligible),
    premium: !!payload.featured,
    trustScore: Math.max(35, numberFrom(payload?.verification?.verificationScore, 0) || (100 - numberFrom(payload?.aiReview?.fraudRiskScore, 45))),
  });

  const getSubmissionPayload = () => {
    const values = getFormValues();
    const photoCount = photosInput?.files?.length || 0;
    const aiSignals = getAiRiskSignals(values, photoCount);
    const trustModel = getTrustModel(values);
    return {
      id: `local-${Date.now()}`,
      ...values,
      media: {
        photosCount: photoCount,
        videoUploaded: Boolean(videoInput?.files?.[0]),
        videoDurationSec: Math.round(videoDurationSeconds || 0),
        photoNames: listFileNames(photosInput?.files),
        videoName: listFileNames(videoInput?.files)[0] || null,
        floorPlanName: listFileNames(document.getElementById('floorPlan')?.files)[0] || null,
      },
      privateDocs: {
        propertyDocuments: trustModel.propertyDocuments,
        ownerIdProof: trustModel.ownerIdProof,
        addressProof: trustModel.addressProof,
        privateViewMode: trustModel.privateViewMode,
      },
      verification: {
        ownerAadhaarPanStatus: values.ownerAadhaarPanStatus || 'Pending',
        addressVerificationStatus: values.addressVerificationStatus || 'Pending',
        ownerKycRef: trustModel.ownerKycRef,
        propertyAddressRef: trustModel.propertyAddressRef,
        verificationOfficerNote: trustModel.verificationOfficerNote,
        privateViewOnly: trustModel.privateViewMode,
        badgeEligible: trustModel.badgeEligible,
        badgeLabel: trustModel.badgeLabel,
        verificationScore: trustModel.score,
      },
      virtualTour: {
        slot: values.virtualTourSlot || null,
      },
      visitBooking: {
        preferredSlot: values.liveVisitSlot || null,
      },
      videoVisit: {
        sellerVideoMin30Sec: videoDurationSeconds >= 30,
        enabled: Boolean(videoInput?.files?.[0]) && videoDurationSeconds >= 30,
        virtualTourOption: values.virtualTourOption || '360 Walkthrough',
        virtualTourSlot: values.virtualTourSlot || null,
        liveVideoVisitSlot: values.liveVideoVisitSlot || values.liveVisitSlot || null,
      },
      aiReview: {
        fraudRiskScore: aiSignals.riskScore,
        riskReasons: aiSignals.reasons,
        recommendation: aiSignals.riskScore > 60 ? 'Manual admin verification required' : 'Looks normal',
      },
      status: 'Pending Approval',
      verifiedByPropertySetu: trustModel.badgeEligible,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      city: 'Udaipur',
    };
  };

  const pushLiveProperty = async (payload) => {
    if (!live.request) throw new Error('Live API unavailable.');
    const token = (live.getToken && (live.getToken('customer') || live.getToken('admin'))) || '';
    if (!token) throw new Error('Login required. Please login from home page.');
    const response = await live.request('/properties', {
      method: 'POST',
      data: payload,
      token,
    });
    return response?.property || null;
  };

  citySelect?.addEventListener('change', forceUdaipurCity);
  [ownerStatusSelect, addressStatusSelect, documentsInput, ownerIdProofInput, addressProofInput].forEach((el) => {
    el?.addEventListener('change', renderTrustModelPreview);
    el?.addEventListener('input', renderTrustModelPreview);
  });

  if (photosInput) {
    photosInput.addEventListener('change', () => {
      const count = photosInput.files.length;
      if (count > 15) {
        photosInput.value = '';
        createPhotoPreview();
        showStatus('Max 15 photos allowed.', false);
        return;
      }
      createPhotoPreview();
      showStatus(count < 5 ? 'Please upload minimum 5 photos.' : `Great! ${count} photos selected.`, count >= 5);
      renderTrustModelPreview();
    });
  }

  if (videoInput) {
    videoInput.addEventListener('change', () => {
      createVideoPreview();
    });
  }

  saveDraftBtn?.addEventListener('click', saveDraft);
  getPriceSuggestionBtn?.addEventListener('click', getSmartPricing);
  generateAiDescriptionBtn?.addEventListener('click', generateAiDescription);

  clearDraftBtn?.addEventListener('click', () => {
    localStorage.removeItem(DRAFT_KEY);
    form?.reset();
    if (photoPreview) photoPreview.innerHTML = '';
    if (videoPreview) videoPreview.innerHTML = '';
    videoDurationSeconds = 0;
    if (payloadPreview) payloadPreview.textContent = 'No submission yet.';
    showStatus('Draft cleared.', true);
    pushNotification(
      'Add Property draft cleared by user.',
      ['customer', 'seller'],
      'Draft Cleared',
      'info',
    );
    forceUdaipurCity();
    renderVideoVisitStatus();
    renderTrustModelPreview();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const photoCount = photosInput?.files?.length || 0;
    if (photoCount < 5) {
      showStatus('Submission failed: Minimum 5 photos required.', false);
      return;
    }

    const hasVideo = Boolean(videoInput?.files?.[0]);
    if (!hasVideo) {
      showStatus('Submission failed: Seller 30 sec property video required for Video Visit feature.', false);
      renderVideoVisitStatus();
      return;
    }
    if (!videoDurationSeconds) {
      await createVideoPreview();
    }
    if (videoDurationSeconds < 30) {
      showStatus(`Submission failed: Video ${Math.round(videoDurationSeconds || 0)} sec hai. Minimum 30 sec required.`, false);
      renderVideoVisitStatus();
      return;
    }

    const payload = getSubmissionPayload();
    renderPayloadPreview(payload);

    try {
      const liveProperty = await pushLiveProperty(payload);
      const normalized = live.normalizeApiListing
        ? live.normalizeApiListing(liveProperty)
        : normalizeLocalListing({ ...payload, ...liveProperty, id: liveProperty?.id || payload.id });

      if (normalized) upsertLocalListing(normalized);
      showStatus(`Property submitted live. Status: ${liveProperty?.status || 'Pending Approval'}. ${payload.verifiedByPropertySetu ? 'Verified by PropertySetu badge ready.' : 'Verification pending.'}`, true);
      pushNotification(
        `New property "${payload.title}" submitted live in Udaipur. Video Visit ready (${Math.round(videoDurationSeconds)} sec). Status: ${liveProperty?.status || 'Pending Approval'}. ${payload.verifiedByPropertySetu ? 'Trust badge eligible.' : 'Trust verification pending.'}`,
        ['customer', 'seller', 'admin'],
        'Listing Submitted',
        'success',
      );
    } catch (error) {
      const normalized = normalizeLocalListing(payload);
      upsertLocalListing(normalized);
      const canFallback = live.shouldFallbackToLocal ? live.shouldFallbackToLocal(error) : true;
      if (canFallback) {
        showStatus(`Live submit unavailable. Local backup me save kar diya: ${error.message}`, false);
        pushNotification(
          `Listing "${payload.title}" local backup queue me save hui. Live sync pending.`,
          ['customer', 'seller', 'admin'],
          'Listing Queued',
          'warn',
        );
      } else {
        showStatus(error.message || 'Submission failed.', false);
        pushNotification(
          `Listing "${payload.title}" submit failed: ${error.message || 'Unknown error'}.`,
          ['customer', 'seller', 'admin'],
          'Listing Submit Failed',
          'error',
        );
      }
    }

    form.reset();
    if (photoPreview) photoPreview.innerHTML = '';
    if (videoPreview) videoPreview.innerHTML = '';
    videoDurationSeconds = 0;
    localStorage.removeItem(DRAFT_KEY);
    forceUdaipurCity();
    renderVideoVisitStatus();
    renderTrustModelPreview();
  });

  forceUdaipurCity();
  loadDraft();
  renderVideoVisitStatus();
  renderTrustModelPreview();

  if (live.syncLocalListingsFromApi) {
    live.syncLocalListingsFromApi().catch(() => {
      // keep working with local data when API is unreachable
    });
  }
})();
