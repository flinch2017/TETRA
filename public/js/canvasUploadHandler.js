export function setupCanvasUpload() {
  const canvasUpload = document.getElementById('canvasUpload');
  const canvasInput = document.getElementById('canvasInput');
  const canvasPreview = document.getElementById('canvasPreview');
  const canvasPlusIcon = canvasUpload.querySelector('.plus-icon');

  canvasUpload.addEventListener('click', () => {
    canvasInput.click();
  });

  canvasInput.addEventListener('change', () => {
    const file = canvasInput.files[0];
    if (!file) return;

    if (file.type !== 'video/mp4') {
      alert('Only MP4 videos are allowed.');
      canvasInput.value = '';
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);

      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      const aspectRatio = width / height;

      const targetAspect = 9 / 16;
      const tolerance = 0.01;

      if (duration < 3 || duration > 8) {
        alert('Video must be between 3 and 8 seconds.');
        canvasInput.value = '';
        return;
      }

      if (Math.abs(aspectRatio - targetAspect) > tolerance) {
        alert('Video must be vertical with a 9:16 aspect ratio.');
        canvasInput.value = '';
        return;
      }

      const previewURL = URL.createObjectURL(file);
      canvasPreview.src = previewURL;
      canvasPreview.style.display = 'block';
      canvasPreview.play();
      canvasPlusIcon.style.display = 'none';
    };

    video.onerror = () => {
      alert('Could not load video. Please upload a valid MP4 file.');
      canvasInput.value = '';
    };

    video.src = URL.createObjectURL(file);
  });
}
