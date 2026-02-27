const form = document.getElementById('addPropertyForm');
const photosInput = document.getElementById('photos');
const videoInput = document.getElementById('video');
const photoPreview = document.getElementById('photoPreview');
const videoPreview = document.getElementById('videoPreview');
const statusArea = document.getElementById('statusArea');
const payloadPreview = document.getElementById('payloadPreview');
const saveDraftBtn = document.getElementById('saveDraft');
const clearDraftBtn = document.getElementById('clearDraft');
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
    media: {
      photos: photosInput?.files?.length || 0,
      video: Boolean(videoInput?.files?.[0]),
    },
  };
};

const renderPayloadPreview = (payload) => {
  if (payloadPreview) payloadPreview.textContent = JSON.stringify(payload, null, 2);
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

    const payload = buildPayload();
    renderPayloadPreview(payload);
    showStatus('Property submitted in demo mode. Backend API integration can be added next.');
  });
}
