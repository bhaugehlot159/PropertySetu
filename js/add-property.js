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

  const DRAFT_KEY = 'propertySetu:addPropertyDraft';
  const LISTINGS_KEY = 'propertySetu:listings';

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

  const text = (value) => String(value || '').trim();
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const showStatus = (message, ok = true) => {
    if (!statusArea) return;
    statusArea.innerHTML = `<div class="status-box ${ok ? 'ok' : 'err'}">${message}</div>`;
  };

  const listFileNames = (fileList) => Array.from(fileList || []).map((file) => file.name);

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
      landmark: get('landmark'),
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

  const createVideoPreview = () => {
    if (!videoPreview || !videoInput) return;
    videoPreview.innerHTML = '';
    const file = videoInput.files?.[0];
    if (!file) return;
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.controls = true;
    videoPreview.appendChild(video);
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

  const saveDraft = () => {
    const draft = getFormValues();
    writeJson(DRAFT_KEY, draft);
    showStatus('Draft saved successfully.', true);
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
    verified: payload.status === 'Approved' || false,
    premium: !!payload.featured,
    trustScore: Math.max(35, 100 - numberFrom(payload?.aiReview?.fraudRiskScore, 45)),
  });

  const getSubmissionPayload = () => {
    const values = getFormValues();
    const photoCount = photosInput?.files?.length || 0;
    const aiSignals = getAiRiskSignals(values, photoCount);
    return {
      id: `local-${Date.now()}`,
      ...values,
      media: {
        photosCount: photoCount,
        videoUploaded: Boolean(videoInput?.files?.[0]),
        photoNames: listFileNames(photosInput?.files),
        videoName: listFileNames(videoInput?.files)[0] || null,
        floorPlanName: listFileNames(document.getElementById('floorPlan')?.files)[0] || null,
      },
      privateDocs: {
        propertyDocuments: listFileNames(document.getElementById('documents')?.files),
        ownerIdProof: listFileNames(document.getElementById('ownerIdProof')?.files)[0] || null,
        addressProof: listFileNames(document.getElementById('addressProof')?.files)[0] || null,
      },
      aiReview: {
        fraudRiskScore: aiSignals.riskScore,
        riskReasons: aiSignals.reasons,
        recommendation: aiSignals.riskScore > 60 ? 'Manual admin verification required' : 'Looks normal',
      },
      status: 'Pending Approval',
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
    });
  }

  if (videoInput) {
    videoInput.addEventListener('change', createVideoPreview);
  }

  saveDraftBtn?.addEventListener('click', saveDraft);

  clearDraftBtn?.addEventListener('click', () => {
    localStorage.removeItem(DRAFT_KEY);
    form?.reset();
    if (photoPreview) photoPreview.innerHTML = '';
    if (videoPreview) videoPreview.innerHTML = '';
    if (payloadPreview) payloadPreview.textContent = 'No submission yet.';
    showStatus('Draft cleared.', true);
    forceUdaipurCity();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const photoCount = photosInput?.files?.length || 0;
    if (photoCount < 5) {
      showStatus('Submission failed: Minimum 5 photos required.', false);
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
      showStatus(`Property submitted live. Status: ${liveProperty?.status || 'Pending Approval'}.`, true);
    } catch (error) {
      const normalized = normalizeLocalListing(payload);
      upsertLocalListing(normalized);
      const canFallback = live.shouldFallbackToLocal ? live.shouldFallbackToLocal(error) : true;
      if (canFallback) {
        showStatus(`Live submit unavailable. Local backup me save kar diya: ${error.message}`, false);
      } else {
        showStatus(error.message || 'Submission failed.', false);
      }
    }

    form.reset();
    if (photoPreview) photoPreview.innerHTML = '';
    if (videoPreview) videoPreview.innerHTML = '';
    localStorage.removeItem(DRAFT_KEY);
    forceUdaipurCity();
  });

  forceUdaipurCity();
  loadDraft();

  if (live.syncLocalListingsFromApi) {
    live.syncLocalListingsFromApi().catch(() => {
      // keep working with local data when API is unreachable
    });
  }
})();
