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

  renderPayloadPreview(values);
  showStatus('Property submitted in demo mode. Backend API can now consume this payload structure.', true);
});

loadDraft();
