// trackUploader.js
import { saveUploadedKey } from './uploadManager.js';

export function uploadTrack({
  file,
  releaseId,
  trackId,
  uploadBar,
  onSuccess,
  onError,
  statusTextEl,         // NEW: Element to show retrying messages
  disableSubmitButton   // NEW: Function to disable/enable submit button
}) {
  const maxRetries = 3;
  let attempt = 0;

  function tryUpload() {
    if (disableSubmitButton) disableSubmitButton(true); // Disable submit during upload

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload-track');

    const form = new FormData();
    form.append('track', file);
    form.append('releaseId', releaseId);
    form.append('trackId', trackId);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        uploadBar.style.setProperty('--upload-percent', percent + '%');
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          saveUploadedKey(res.key);

          if (statusTextEl) statusTextEl.textContent = '';
          if (disableSubmitButton) disableSubmitButton(false);

          if (onSuccess) onSuccess(res.key);
        } catch (err) {
          handleRetry(err);
        }
      } else {
        handleRetry(new Error('Upload failed with status ' + xhr.status));
      }
    };

    xhr.onerror = () => {
      handleRetry(new Error('Network or socket error'));
    };

    xhr.send(form);
  }

  function handleRetry(error) {
    attempt++;

    if (attempt < maxRetries) {
      if (statusTextEl) {
        statusTextEl.textContent = `Retrying upload (${attempt}/${maxRetries})...`;
      }

      setTimeout(() => {
        tryUpload();
      }, 1000 * attempt); // Backoff delay
    } else {
      if (statusTextEl) {
        statusTextEl.textContent = 'Upload failed after multiple attempts.';
      }

      uploadBar.style.backgroundColor = 'red';

      if (disableSubmitButton) disableSubmitButton(false);
      if (onError) onError(error);
    }
  }

  tryUpload();
}
