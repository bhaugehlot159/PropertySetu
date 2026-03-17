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

const showStatus = (message, ok = true) => {
  if (!statusArea) return;
  statusArea.innerHTML = `<div class="status-box ${ok ? 'ok' : 'err'}">${message}</div>`;
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const listFileNames = (fileList) => Array.from(fileList || []).map((file) => file.name);

const forceUdaipurCity = () => {
  if (!citySelect) return;
  citySelect.value = 'Udaipur';
  citySelect.disabled = true;
};

const getFormValues = () => {
  const get = (id) => (document.getElementById(id)?.value || '').trim();
  return {
    title: get('title'),
    city: 'Udaipur',
    type: get('type'),
    category: get('category'),
    location: get('location'),
    price: Number(get('price') || 0),
    negotiable: get('negotiable'),
    description: get('description'),
    plotSize: get('plotSize'),
    builtUpArea: get('builtUpArea'),
    carpetArea: get('carpetArea'),
    floors: get('floors'),
    facing: get('facing'),
    furnished: get('furnished'),
    bedrooms: get('bedrooms'),
    bathrooms: get('bathrooms'),
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

citySelect?.addEventListener('change', forceUdaipurCity);

const saveListing = (payload) => {
  const listings = readJson(LISTINGS_KEY, []);
  listings.unshift(payload);
  writeJson(LISTINGS_KEY, listings);
};

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
});

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  const values = getFormValues();
  const photoCount = photosInput?.files?.length || 0;
  if (photoCount < 5) {
    showStatus('Submission failed: Minimum 5 photos required.', false);
    return;
  }

  const aiSignals = getAiRiskSignals(values, photoCount);
  const payload = {
    id: `prop-${Date.now()}`,
    ...values,
    media: {
      photosCount: photoCount,
      videoUploaded: Boolean(videoInput?.files?.[0]),
      photoNames: listFileNames(photosInput?.files),
      videoName: listFileNames(videoInput?.files)[0] || null,
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
  };

  saveListing(payload);
  renderPayloadPreview(payload);
  showStatus(`Property submitted successfully. Status: ${payload.status}`, true);

  form.reset();
  if (photoPreview) photoPreview.innerHTML = '';
  if (videoPreview) videoPreview.innerHTML = '';
  localStorage.removeItem(DRAFT_KEY);
});

forceUdaipurCity();
loadDraft();
