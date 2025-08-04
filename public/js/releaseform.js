// releaseform.js
import { createTrackCard } from './trackCardBuilder.js';
import { initializeSortable, updateTrackOrder } from './trackOrderManager.js';
import { setupUnloadHandler } from './uploadManager.js';
import { setupCanvasUpload } from './canvasUploadHandler.js';
import { setupArtworkUpload } from './artworkUploadHandler.js';
import { setupFormSubmission } from './formSubmitHandler.js';

let formState = { submitted: false };
setupFormSubmission(formState);


document.addEventListener('DOMContentLoaded', () => {
  const addTrackBtn = document.getElementById('addTrackBtn');
  const tracklistContainer = document.getElementById('tracklistContainer');
  const artistAlert = document.getElementById('artistAlert');
  const releaseForm = document.querySelector('.releaseform');
  const releaseId = releaseForm.dataset.releaseId;
  const currentUser = releaseForm.dataset.currentUser;

  const trackOrderInput = document.createElement('input');
  trackOrderInput.type = 'hidden';
  trackOrderInput.name = 'track_order';
  tracklistContainer.appendChild(trackOrderInput);

  addTrackBtn.addEventListener('click', () => {
    if (tracklistContainer.querySelectorAll('.track-card').length >= 3) {
      alert('You can only upload up to 3 tracks.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/mpeg';
    input.style.display = 'none';

    input.addEventListener('change', () => {
      if (input.files.length === 0) return;

      const file = input.files[0];
      const { card, input: hiddenInput } = createTrackCard({
        file,
        releaseId,
        currentUser,
        showArtistAlert,
        tracklistContainer,
        trackOrderInput
      });

      tracklistContainer.appendChild(hiddenInput);
      tracklistContainer.appendChild(card);
      updateTrackOrder(tracklistContainer, trackOrderInput);
    });

    tracklistContainer.appendChild(input);
    input.click();
  });

  function showArtistAlert() {
    artistAlert.style.display = 'flex';
    setTimeout(() => {
      artistAlert.style.display = 'none';
    }, 3000);
  }

  setupCanvasUpload();
  setupArtworkUpload();
  initializeSortable(tracklistContainer, trackOrderInput);
  setupUnloadHandler(() => formState.submitted);
});
