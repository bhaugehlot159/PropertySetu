const form = document.getElementById('addPropertyForm');
const photosInput = document.getElementById('photos');
const videoInput = document.getElementById('video');
const photoPreview = document.getElementById('photoPreview');
const videoPreview = document.getElementById('videoPreview');
const statusArea = document.getElementById('statusArea');
const payloadPreview = document.getElementById('payloadPreview');
const saveDraftBtn = document.getElementById('saveDraft');
const clearDraftBtn = document.getElementById('clearDraft');
const locationInput = document.getElementById('location');
const locationSuggestions = document.getElementById('propertyLocationSuggestions');

const draftKey = 'propertySetu:addPropertyDraft';
const locationSuggestions = document.getElementById('propertyLocationSuggestions');

const showStatus = (message, ok = true) => {
  if (!statusArea) return;
  statusArea.innerHTML = `<div class="status-box ${ok ? 'ok' : 'err'}">${message}</div>`;
};

const buildPayload = () => {
  const field = (id) => document.getElementById(id)?.value?.trim() || '';
  return {
    title: field('title'),
    city: field('city'),
    type: field('type'),
    category: field('category'),
    location: field('location'),
    price: Number(field('price') || 0),
    negotiable: field('negotiable'),
    description: field('description'),
    details: {
      plotSize: field('plotSize'),
      builtUpArea: field('builtUpArea'),
      carpetArea: field('carpetArea'),
      floors: field('floors'),
      facing: field('facing'),
      furnished: field('furnished'),
      bedrooms: field('bedrooms'),
      bathrooms: field('bathrooms'),
      parking: field('parking'),
      landmark: field('landmark'),
    },
const listFileNames = (fileList) => Array.from(fileList || []).map((file) => file.name);

const createPhotoPreview = () => {
  photoPreview.innerHTML = '';
  Array.from(photosInput.files || []).forEach((file) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    photoPreview.appendChild(img);
  });
};

const createVideoPreview = () => {
  videoPreview.innerHTML = '';
  const file = videoInput.files?.[0];
  if (!file) return;
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.controls = true;
  videoPreview.appendChild(video);
};

const getFormValues = () => {
  const fields = ['title', 'city', 'type', 'category', 'location', 'price', 'negotiable', 'description'];
  const values = {};
  fields.forEach((id) => {
    const element = document.getElementById(id);
    values[id] = element ? element.value.trim() : '';
  });
  return values;
};

const getAiRiskSignals = (values) => {
  const riskyWords = ['urgent sale', 'cash only', 'advance first', 'no visit'];
  const raw = `${values.title} ${values.description}`.toLowerCase();
  const badWords = riskyWords.filter((word) => raw.includes(word));
  const suspiciousPrice = Number(values.price) > 0 && Number(values.price) < 300000;
  const lowMediaProof = photosInput.files.length < 5;
  const riskScore = badWords.length * 30 + (suspiciousPrice ? 30 : 0) + (lowMediaProof ? 40 : 0);
  return {
    riskScore: Math.min(riskScore, 100),
    reasons: [
      ...badWords.map((word) => `Contains risky phrase: "${word}"`),
      ...(suspiciousPrice ? ['Price looks abnormally low for Udaipur market'] : []),
      ...(lowMediaProof ? ['Not enough photos for verification'] : []),
    ],
  };
};

const getFormValues = () => {
  const fields = [
    'title', 'city', 'type', 'category', 'location', 'price', 'negotiable', 'description',
    'plotSize', 'builtUpArea', 'carpetArea', 'floors', 'facing', 'furnished',
    'bedrooms', 'bathrooms', 'parking', 'landmark',
  ];

  return fields.reduce((acc, id) => {
    const element = document.getElementById(id);
    acc[id] = element ? element.value.trim() : '';
    return acc;
  }, {});
};

const renderPayloadPreview = (values) => {
  const aiSignals = getAiRiskSignals(values);
  const payload = {
    ...values,
    media: {
      photos: photosInput?.files?.length || 0,
      video: Boolean(videoInput?.files?.[0]),
    },
  };
};

const renderPayloadPreview = (payload) => {
  if (payloadPreview) payloadPreview.textContent = JSON.stringify(payload, null, 2);
    privateDocs: {
      propertyDocuments: listFileNames(document.getElementById('documents').files),
      ownerIdProof: listFileNames(document.getElementById('ownerIdProof').files)[0] || null,
      addressProof: listFileNames(document.getElementById('addressProof').files)[0] || null,
    },
    aiReview: {
      fraudRiskScore: aiSignals.riskScore,
      riskReasons: aiSignals.reasons,
      recommendation: aiSignals.riskScore > 60 ? 'Manual admin verification required' : 'Looks normal',
    },
    verificationStatus: 'Pending Admin Approval',
  };

  payloadPreview.textContent = JSON.stringify(payload, null, 2);
  return aiSignals;
};

const saveDraft = () => {
  localStorage.setItem(draftKey, JSON.stringify(getFormValues()));
  showStatus('Draft saved locally in this browser.', true);
};

if (locationSuggestions && Array.isArray(window.PROPERTYSETU_LOCATIONS)) {
  locationSuggestions.innerHTML = window.PROPERTYSETU_LOCATIONS
    .map((location) => `<option value="${location}"></option>`)
    .join('');
}

if (photosInput && photoPreview) {
  photosInput.addEventListener('change', () => {
    photoPreview.innerHTML = '';
    Array.from(photosInput.files || []).slice(0, 15).forEach((file) => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      photoPreview.appendChild(img);
    });
  });
}

if (videoInput && videoPreview) {
  videoInput.addEventListener('change', () => {
    videoPreview.innerHTML = '';
    const file = videoInput.files?.[0];
    if (!file) return;
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.controls = true;
    videoPreview.appendChild(video);
  });
}

if (saveDraftBtn && form) {
  saveDraftBtn.addEventListener('click', () => {
    const payload = buildPayload();
    localStorage.setItem(draftKey, JSON.stringify(payload));
    renderPayloadPreview(payload);
    showStatus('Draft saved successfully.');
  });
}

if (clearDraftBtn && form) {
  clearDraftBtn.addEventListener('click', () => {
    localStorage.removeItem(draftKey);
    showStatus('Draft cleared.');
  });
}

if (form) {
  const draft = localStorage.getItem(draftKey);
  if (draft) {
    try {
      const data = JSON.parse(draft);
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object') return;
        const element = document.getElementById(key);
        if (element && value !== undefined && value !== null) element.value = value;
      });
      showStatus('Draft loaded from local storage.');
    } catch {
      localStorage.removeItem(draftKey);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const photoCount = photosInput?.files?.length || 0;
    if (photoCount < 5) {
      showStatus('Minimum 5 photos are required.', false);
      return;
    }
    showStatus('Saved draft restored. Re-upload files before submitting.', true);
    renderPayloadPreview(values);
  } catch {
    showStatus('Draft data corrupted, please clear draft.', false);
  }
};

const setupLocationAutocomplete = () => {
  const locations = window.PROPERTYSETU_LOCATIONS || [];
  if (!locationSuggestions) return;

  locationSuggestions.innerHTML = locations.map((loc) => `<option value="${loc}"></option>`).join('');
};

photosInput.addEventListener('change', () => {
  const total = photosInput.files.length;

  if (total > 15) {
    showStatus('Max 15 photos allowed in demo form.', false);
    photosInput.value = '';
    createPhotoPreview();
    return;
  }

  createPhotoPreview();
  showStatus(total < 5 ? 'Please upload minimum 5 photos.' : `Great! ${total} photos selected.`, total >= 5);
});

videoInput.addEventListener('change', createVideoPreview);
saveDraftBtn.addEventListener('click', saveDraft);

clearDraftBtn.addEventListener('click', () => {
  localStorage.removeItem(draftKey);
  form.reset();
  photoPreview.innerHTML = '';
  videoPreview.innerHTML = '';
  payloadPreview.textContent = 'No submission yet.';
  showStatus('Draft cleared.', true);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (photosInput.files.length < 5) {

  const values = getFormValues();
  const photoCount = photosInput.files.length;
  if (photoCount < 5) {
    showStatus('Submission failed: Minimum 5 photos required.', false);
    return;
  }

  const aiSignals = renderPayloadPreview(getFormValues());
  const aiSignals = getAiRiskSignals(values);
  renderPayloadPreview(values);
  showStatus(`Property submitted in demo mode. AI fraud risk score: ${aiSignals.riskScore}/100.`, aiSignals.riskScore < 70);
});

    const payload = buildPayload();
    renderPayloadPreview(payload);
    showStatus('Property submitted in demo mode. Backend API integration can be added next.');
  });
}
