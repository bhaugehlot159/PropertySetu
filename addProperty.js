(() => {
  const live = window.PropertySetuLive || {};
  const allowDemoFallback = Boolean(live.allowDemoFallback);
  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  const writeJson = live.writeJson || ((key, value) => localStorage.setItem(key, JSON.stringify(value)));
  const QUEUE_KEY = 'propertySetu:queuedProperties';

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  }[char]));

  const queueProperty = (payload) => {
    const queued = readJson(QUEUE_KEY, []);
    queued.unshift({
      ...payload,
      queuedAt: new Date().toISOString(),
      source: 'local-fallback',
    });
    writeJson(QUEUE_KEY, queued.slice(0, 100));
  };

  const buildPayload = (formElement) => {
    const title = String(formElement.querySelector('#title')?.value || '').trim();
    const category = String(formElement.querySelector('#category')?.value || 'House').trim() || 'House';
    const city = String(formElement.querySelector('#city')?.value || 'Udaipur').trim() || 'Udaipur';
    const location = String(formElement.querySelector('#location')?.value || city).trim() || city;
    const price = Number(formElement.querySelector('#price')?.value || 0);
    const description = String(formElement.querySelector('#description')?.value || '').trim();
    const photosInput = formElement.querySelector('#photos');
    const videoInput = formElement.querySelector('#video');
    const photosCount = Number(photosInput?.files?.length || 0);
    const videoFile = videoInput?.files?.[0];

    return {
      title,
      category,
      city,
      location,
      price: Number.isFinite(price) ? price : 0,
      description,
      type: 'buy',
      size: 1,
      media: {
        photosCount,
        videoUploaded: Boolean(videoFile),
        videoName: videoFile?.name || '',
      },
    };
  };

  const renderPreview = (previewRoot, payload, photosInput, videoInput) => {
    if (!previewRoot) return;
    previewRoot.innerHTML = `
      <h3>Property Preview</h3>
      <p><b>Title:</b> ${escapeHtml(payload.title)}</p>
      <p><b>Category:</b> ${escapeHtml(payload.category)}</p>
      <p><b>City:</b> ${escapeHtml(payload.city)}</p>
      <p><b>Location:</b> ${escapeHtml(payload.location)}</p>
      <p><b>Price:</b> ₹${Number(payload.price || 0).toLocaleString('en-IN')}</p>
      <p><b>Description:</b> ${escapeHtml(payload.description || 'N/A')}</p>
      <p><b>Photos:</b></p>
    `;

    const photoFiles = Array.from(photosInput?.files || []);
    photoFiles.forEach((file) => {
      const img = document.createElement('img');
      img.className = previewRoot.id === 'photoPreview' ? 'preview' : 'preview-img';
      img.src = URL.createObjectURL(file);
      previewRoot.appendChild(img);
    });

    const videoFile = videoInput?.files?.[0];
    if (videoFile) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = URL.createObjectURL(videoFile);
      video.style.maxWidth = '300px';
      video.className = previewRoot.id === 'videoPreview' ? 'preview' : '';
      previewRoot.appendChild(document.createElement('br'));
      previewRoot.appendChild(video);
    }
  };

  const submitProperty = async (payload) => {
    if (!live.request) {
      throw new Error('Live backend unavailable.');
    }
    return live.request('/properties', {
      method: 'POST',
      data: payload,
    });
  };

  const bindForm = ({ formId, previewId, photoPreviewId, videoPreviewId }) => {
    const formElement = document.getElementById(formId);
    if (!formElement) return;

    const previewRoot = document.getElementById(previewId);
    const photoPreview = document.getElementById(photoPreviewId);
    const videoPreview = document.getElementById(videoPreviewId);
    const photosInput = formElement.querySelector('#photos');
    const videoInput = formElement.querySelector('#video');

    photosInput?.addEventListener('change', function onPhotoChange() {
      if (photoPreview) photoPreview.innerHTML = '';
      if (Number(this.files.length || 0) > 20) {
        window.alert('Maximum 20 photos allowed.');
        this.value = '';
        return;
      }
      Array.from(this.files).forEach((file) => {
        if (!photoPreview) return;
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'preview';
        photoPreview.appendChild(img);
      });
    });

    videoInput?.addEventListener('change', function onVideoChange() {
      if (!videoPreview) return;
      videoPreview.innerHTML = '';
      const file = this.files?.[0];
      if (!file) return;
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.className = 'preview';
      video.controls = true;
      videoPreview.appendChild(video);
    });

    formElement.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = buildPayload(formElement);
      const photoCount = Number(photosInput?.files?.length || 0);
      const videoFile = videoInput?.files?.[0];

      if (!payload.title || !payload.location || payload.price <= 0) {
        window.alert('Title, location, and valid price required.');
        return;
      }
      if (photoCount < 5) {
        window.alert('Minimum 5 photos required.');
        return;
      }
      if (!videoFile) {
        window.alert('1 property video required.');
        return;
      }

      renderPreview(previewRoot || photoPreview, payload, photosInput, videoInput);

      try {
        await submitProperty(payload);
        window.alert('Property submitted successfully (live).');
        formElement.reset();
        if (photoPreview) photoPreview.innerHTML = '';
        if (videoPreview) videoPreview.innerHTML = '';
      } catch (error) {
        if (allowDemoFallback) {
          queueProperty(payload);
          window.alert(`Live submit failed, queued locally: ${error.message}`);
          return;
        }
        window.alert(`Property submit failed: ${error.message}`);
      }
    });
  };

  bindForm({
    formId: 'propertyForm',
    previewId: 'preview',
    photoPreviewId: 'preview',
    videoPreviewId: 'preview',
  });

  bindForm({
    formId: 'addPropertyForm',
    previewId: 'preview',
    photoPreviewId: 'photoPreview',
    videoPreviewId: 'videoPreview',
  });
})();
