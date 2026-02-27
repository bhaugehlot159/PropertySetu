const form = document.getElementById('addPropertyForm');
const photosInput = document.getElementById('photos');
const videoInput = document.getElementById('video');
const photoPreview = document.getElementById('photoPreview');
const videoPreview = document.getElementById('videoPreview');
const statusArea = document.getElementById('statusArea');
const payloadPreview = document.getElementById('payloadPreview');
const saveDraftBtn = document.getElementById('saveDraft');
const clearDraftBtn = document.getElementById('clearDraft');
codex/develop-complete-propertysetu-website-structure-ajuciq

const locationInput = document.getElementById('location');
const locationSuggestions = document.getElementById('propertyLocationSuggestions');

const draftKey = 'propertySetu:addPropertyDraft';

const showStatus = (message, ok = true) => {
  statusArea.innerHTML = `<div class="status-box ${ok ? 'ok' : 'err'}">${message}</div>`;
};

const listFileNames = (fileList) => Array.from(fileList || []).map((file) => file.name);

const createPhotoPreview = () => {
  photoPreview.innerHTML = '';
  const files = Array.from(photosInput.files || []);

  files.forEach((file) => {
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

codex/develop-complete-propertysetu-website-structure-ajuciq
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

const renderPayloadPreview = (values) => {
  const aiSignals = getAiRiskSignals(values);
  const payload = {
    ...values,
    media: {
      photos: listFileNames(photosInput.files),
      video: listFileNames(videoInput.files)[0] || null,
      floorPlan: listFileNames(document.getElementById('floorPlan').files)[0] || null,
    },
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
  if (total < 5) {
    showStatus('Please upload minimum 5 photos.', false);
  } else {
    showStatus(`Great! ${total} photos selected.`, true);
  }
});

videoInput.addEventListener('change', createVideoPreview);

const getFormValues = () => {
  const fields = [
    'title', 'city', 'type', 'category', 'location', 'price', 'negotiable', 'description',
    'plotSize', 'builtUpArea', 'carpetArea', 'floors', 'facing', 'furnished',
    'bedrooms', 'bathrooms', 'parking', 'landmark',
  ];

  const values = {};
  fields.forEach((id) => {
    const element = document.getElementById(id);
    values[id] = element ? element.value.trim() : '';
  });

  return values;
};

codex/develop-complete-propertysetu-website-structure-ajuciq
const renderPayloadPreview = (values) => {
  const payload = {
    ...values,
    media: {
      photos: listFileNames(photosInput.files),
      video: listFileNames(videoInput.files)[0] || null,
      floorPlan: listFileNames(document.getElementById('floorPlan').files)[0] || null,
    },
    privateDocs: {
      propertyDocuments: listFileNames(document.getElementById('documents').files),
      ownerIdProof: listFileNames(document.getElementById('ownerIdProof').files)[0] || null,
      addressProof: listFileNames(document.getElementById('addressProof').files)[0] || null,
    },
    verificationStatus: 'Pending Admin Approval',
  };

  payloadPreview.textContent = JSON.stringify(payload, null, 2);
};

const saveDraft = () => {
  const values = getFormValues();
  localStorage.setItem(draftKey, JSON.stringify(values));
  renderPayloadPreview(values);
  showStatus('Draft saved locally in this browser.', true);
};

const loadDraft = () => {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return;

  try {
    const values = JSON.parse(raw);
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });
    renderPayloadPreview(values);
    showStatus('Saved draft restored. Re-upload files before submitting.', true);
  } catch (error) {
    showStatus('Draft data corrupted, please clear draft.', false);
  }
};

codex/develop-complete-propertysetu-website-structure-ajuciq

const setupLocationAutocomplete = () => {
  if (!locationInput || !locationSuggestions) return;
  const locations = window.PROPERTYSETU_LOCATIONS || [];
  locationSuggestions.innerHTML = locations.map((loc) => `<option value="${loc}"></option>`).join('');
};

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

  const values = getFormValues();
  const photoCount = photosInput.files.length;

  if (photoCount < 5) {
    showStatus('Submission failed: Minimum 5 photos required.', false);
    return;
  }

codex/develop-complete-propertysetu-website-structure-ajuciq
  renderPayloadPreview(values);
  showStatus('Property submitted in demo mode. Backend API can now consume this payload structure.', true);
});

  const aiSignals = getAiRiskSignals(values);
  renderPayloadPreview(values);
  showStatus(`Property submitted in demo mode. AI fraud risk score: ${aiSignals.riskScore}/100.`, aiSignals.riskScore < 70);

  const notification = {
    id: Date.now(),
    message: `New property submitted: ${values.title || 'Untitled'} (${values.location || 'Udaipur'})`,
    createdAt: new Date().toISOString(),
    type: aiSignals.riskScore > 60 ? 'alert' : 'success',
  };

  const current = JSON.parse(localStorage.getItem('propertySetu:notifications') || '[]');
  localStorage.setItem('propertySetu:notifications', JSON.stringify([notification, ...current].slice(0, 20)));
});

setupLocationAutocomplete();
loadDraft();
