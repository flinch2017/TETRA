// trackUploader.js
import { saveUploadedKey } from './uploadManager.js';

export function uploadTrack({ file, releaseId, trackId, uploadBar, onSuccess, onError }) {
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
        if (onSuccess) onSuccess(res.key);
      } catch (err) {
        console.error('Failed to parse response', err);
        if (onError) onError();
      }
    } else {
      console.error('Upload failed:', xhr.responseText);
      uploadBar.style.backgroundColor = 'red';
      if (onError) onError();
    }
  };

  xhr.onerror = () => {
    console.error('XHR error');
    uploadBar.style.backgroundColor = 'red';
    if (onError) onError();
  };

  xhr.send(form);
}
