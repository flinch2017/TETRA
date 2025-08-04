import { generateUniqueCode } from './idGenerator.js';
import { uploadTrack } from './trackUploader.js';
import { createArtistSelector } from './artistSelector.js';
import { removeUploadedKey } from './uploadManager.js';
import { updateTrackOrder } from './trackOrderManager.js';

export function createTrackCard({
  file,
  releaseId,
  currentUser,
  showArtistAlert,
  tracklistContainer,
  trackOrderInput
}) {
  const trackId = `${releaseId}-${generateUniqueCode(8)}`;

  const card = document.createElement('div');
  card.className = 'track-card';

  // Drag UI
  const dragContainer = document.createElement('div');
  dragContainer.className = 'drag-container';
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = '&#9776;';
  const trackNumber = document.createElement('span');
  trackNumber.className = 'track-number';
  trackNumber.textContent = tracklistContainer.querySelectorAll('.track-card').length + 1;
  dragContainer.appendChild(dragHandle);
  dragContainer.appendChild(trackNumber);
  card.appendChild(dragContainer);

  // Header
  const header = document.createElement('div');
  header.className = 'track-header';
  const filename = document.createElement('div');
  filename.className = 'track-filename';
  filename.textContent = file.name;
  const removeBtn = document.createElement('i');
  removeBtn.className = 'fas fa-times track-remove';
  header.appendChild(filename);
  header.appendChild(removeBtn);
  card.appendChild(header);

  // Audio preview
  const preview = document.createElement('div');
  preview.className = 'audio-preview';
  const circle = document.createElement('div');
  circle.className = 'progress-circle';
  const playBtn = document.createElement('i');
  playBtn.className = 'fas fa-play play-btn';
  circle.appendChild(playBtn);
  preview.appendChild(circle);
  const uploadBar = document.createElement('div');
  uploadBar.className = 'upload-progress';
  preview.appendChild(uploadBar);
  card.appendChild(preview);

  const audio = document.createElement('audio');
  audio.src = URL.createObjectURL(file);
  audio.preload = 'metadata';
  let isPlaying = false;
  playBtn.addEventListener('click', () => isPlaying ? audio.pause() : audio.play());
  audio.addEventListener('play', () => {
    isPlaying = true;
    playBtn.classList.replace('fa-play', 'fa-pause');
  });
  audio.addEventListener('pause', () => {
    isPlaying = false;
    playBtn.classList.replace('fa-pause', 'fa-play');
  });
  audio.addEventListener('timeupdate', () => {
    const progress = audio.currentTime / audio.duration;
    circle.style.background = `conic-gradient(#007aff ${progress * 360}deg, rgba(255,255,255,0.1) ${progress * 360}deg)`;
  });

  // Upload logic
  uploadTrack({
    file,
    releaseId,
    trackId,
    uploadBar,
    onSuccess: (s3Key) => {
      card.dataset.s3Key = s3Key;
    },
    onError: () => {
      uploadBar.style.backgroundColor = 'red';
    }
  });

  // Fields
  const fields = document.createElement('div');
  fields.className = 'track-fields';

  const trackIdField = document.createElement('input');
  trackIdField.type = 'hidden';
  trackIdField.name = 'trackId';
  trackIdField.value = trackId;
  fields.appendChild(trackIdField);

  const trackTitleField = document.createElement('input');
  trackTitleField.type = 'text';
  trackTitleField.placeholder = 'Track Title*';
  fields.appendChild(trackTitleField);

  const primarySelector = createArtistSelector({
    type: 'primary',
    currentUser,
    onUnknownArtist: showArtistAlert
  });
  fields.appendChild(primarySelector);

  const featuredSelector = createArtistSelector({
    type: 'featured',
    currentUser,
    onUnknownArtist: showArtistAlert
  });
  fields.appendChild(featuredSelector);

  const genreSelect = document.createElement('select');
  genreSelect.name = 'genre';
  genreSelect.innerHTML = `
    <option value="" disabled selected hidden>Select Genre*</option>
    <option value="Pop">Pop</option>
    <option value="Rock">Rock</option>
    <option value="Hip Hop">Hip Hop</option>
    <option value="Electronic">Electronic</option>
    <option value="Jazz">Jazz</option>
    <option value="Classical">Classical</option>
    <option value="Country">Country</option>
  `;
  fields.appendChild(genreSelect);

  const subGenreSelect = document.createElement('select');
  subGenreSelect.name = 'subGenre';
  subGenreSelect.innerHTML = `
    <option value="" disabled selected hidden>Sub-Genre*</option>
    <option value="Alternative">Alternative</option>
    <option value="Dance">Dance</option>
    <option value="Hip-Hop">Hip-Hop</option>
    <option value="Indie">Indie</option>
    <option value="Metal">Metal</option>
    <option value="Pop">Pop</option>
    <option value="R&B">R&B</option>
    <option value="Rock">Rock</option>
  `;
  fields.appendChild(subGenreSelect);

  const composerInput = document.createElement('input');
  composerInput.type = 'text';
  composerInput.placeholder = 'Composer*';
  fields.appendChild(composerInput);

  const producerInput = document.createElement('input');
  producerInput.type = 'text';
  producerInput.placeholder = 'Producer*';
  fields.appendChild(producerInput);

  const isrcInput = document.createElement('input');
  isrcInput.type = 'text';
  isrcInput.placeholder = 'ISRC (If available)';
  isrcInput.name = 'isrc';
  fields.appendChild(isrcInput);

  const bpmInput = document.createElement('input');
  bpmInput.type = 'number';
  bpmInput.placeholder = 'BPM*';
  bpmInput.min = '30';
  bpmInput.max = '300';
  fields.appendChild(bpmInput);

  const moodSelect = document.createElement('select');
  moodSelect.name = 'mood';
  moodSelect.innerHTML = `
    <option value="" disabled selected hidden>Select Mood*</option>
    <option value="Happy">Happy</option>
    <option value="Sad">Sad</option>
    <option value="Energetic">Energetic</option>
    <option value="Calm">Calm</option>
    <option value="Romantic">Romantic</option>
    <option value="Angry">Angry</option>
    <option value="Other">Other</option>
  `;
  fields.appendChild(moodSelect);

  const explicitSelect = document.createElement('select');
  explicitSelect.name = 'explicit';
  explicitSelect.innerHTML = `
    <option value="" disabled selected hidden>Is the track explicit?*</option>
    <option value="Yes">Yes</option>
    <option value="Not Explicit">Not Explicit</option>
    <option value="Clean Version">Clean Version</option>
  `;
  fields.appendChild(explicitSelect);

  // Expand/collapse toggle
  header.onclick = (e) => {
    if (!e.target.classList.contains('track-remove')) {
      fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
    }
  };

  // Remove track logic
  removeBtn.addEventListener('click', async () => {
    if (card.dataset.s3Key) {
      await fetch('/delete-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: card.dataset.s3Key })
      });
      removeUploadedKey(card.dataset.s3Key);
    }

    tracklistContainer.removeChild(card);
    tracklistContainer.removeChild(input);
    updateTrackOrder(tracklistContainer, trackOrderInput);
  });

  card.appendChild(fields);

  // Hidden input to retain file reference in DOM
  const input = document.createElement('input');
  input.type = 'file';
  input.style.display = 'none';

  return { card, input };
}
