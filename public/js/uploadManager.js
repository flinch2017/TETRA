// uploadManager.js
const uploadedS3Keys = new Set();

function saveUploadedKey(key) {
  if (key) uploadedS3Keys.add(key);
}

function removeUploadedKey(key) {
  uploadedS3Keys.delete(key);
}

function setupUnloadHandler(isFormSubmittedRef) {
  window.addEventListener('beforeunload', () => {
    if (isFormSubmittedRef()) return;

    uploadedS3Keys.forEach(key => {
      const data = JSON.stringify({ key });
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon('/delete-track', blob);
    });
  });
}

export { saveUploadedKey, removeUploadedKey, setupUnloadHandler };
