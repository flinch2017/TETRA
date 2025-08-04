import { updateTrackOrder } from './trackOrderManager.js';

export function setupFormSubmission(formSubmittedRef) {
  const form = document.getElementById('releaseForm');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const warningBox = document.getElementById('releaseWarnings');
    const messages = [];

    const getValue = (selector) => document.querySelector(selector)?.value?.trim();

    // Validate main fields
    const artwork = document.querySelector('#artworkInput')?.files.length;
    if (!artwork) messages.push('• Please upload artwork.');
    const releaseTitle = getValue('input[name="release_title"]');
    if (!releaseTitle) messages.push('• Please enter Release Title.');
    const releaseDate = getValue('input[name="release_date"]');
    if (!releaseDate) messages.push('• Please select Release Date.');
    const releaseTime = getValue('input[name="release_time"]');
    if (!releaseTime) messages.push('• Please select Release Time.');
    const releaseZone = getValue('select[name="release_zone"]');
    if (!releaseZone) messages.push('• Please select Timezone.');
    const upc = getValue('input[name="upc"]');
    if (!upc) messages.push('• Please enter UPC.');

    // Validate tracks
    const trackCards = document.querySelectorAll('#tracklistContainer .track-card');
    if (trackCards.length === 0) messages.push('• Please add at least one track.');

    const tracks = [];
    const isrcs = [];

    trackCards.forEach((card, i) => {
      const get = (sel) => card.querySelector(sel)?.value?.trim();
      const title = get('input[placeholder="Track Title*"]');
      const primaryArtistAcodes = get('input[name="primaryArtistAcodes"]');
      const genre = get('select[name="genre"]');
      const subGenre = get('select[name="subGenre"]');
      const composer = get('input[placeholder="Composer*"]');
      const producer = get('input[placeholder="Producer*"]');
      const bpm = get('input[placeholder="BPM*"]');
      const mood = get('select[name="mood"]');
      const explicit = get('select[name="explicit"]');
      const featuredArtistAcodes = get('input[name="featuredArtistAcodes"]');
      const isrc = get('input[name="isrc"]');
      const trackId = get('input[name="trackId"]');
      const s3Key = card.dataset.s3Key;

      if (!title) messages.push(`• Track ${i + 1}: Please enter Track Title.`);
      if (!primaryArtistAcodes) messages.push(`• Track ${i + 1}: Please add at least one Primary Artist.`);
      if (!genre) messages.push(`• Track ${i + 1}: Please select Genre.`);
      if (!subGenre) messages.push(`• Track ${i + 1}: Please select Sub-Genre.`);
      if (!composer) messages.push(`• Track ${i + 1}: Please enter Composer.`);
      if (!producer) messages.push(`• Track ${i + 1}: Please enter Producer.`);
      if (!bpm) messages.push(`• Track ${i + 1}: Please enter BPM.`);
      if (!mood) messages.push(`• Track ${i + 1}: Please select Mood.`);
      if (!explicit) messages.push(`• Track ${i + 1}: Please select if track is Explicit.`);
      if (isrc) isrcs.push(isrc);

      tracks.push({ trackId, title, primaryArtistAcodes, featuredArtistAcodes, genre, subGenre, composer, producer, bpm, mood, explicit, isrc, s3Key });
    });

    if (trackCards.length === 1 && tracks[0].title.toLowerCase() !== releaseTitle.toLowerCase()) {
      messages.push('• You have only added one track. Please make sure the Release Title and Track Title match (they currently do not).');
    }

    // Check for duplicate ISRC/UPC
    if (isrcs.length > 0 || upc) {
      try {
        const resp = await fetch('/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isrcs, upc })
        });
        const result = await resp.json();
        if (result.duplicateISRCs?.length) {
          result.duplicateISRCs.forEach(d => messages.push(`• The ISRC "${d}" already exists in the system.`));
        }
        if (result.duplicateUPC) {
          messages.push(`• The UPC "${upc}" already exists in the system.`);
        }
      } catch (err) {
        console.error('Duplicate check error:', err);
        messages.push('• Could not verify ISRC/UPC duplicates. Please try again later.');
      }
    }

    if (messages.length > 0) {
      warningBox.innerHTML = messages.join('<br>');
      warningBox.style.display = 'block';
      window.scrollTo({ top: warningBox.offsetTop - 20, behavior: 'smooth' });
      return;
    }

    warningBox.style.display = 'none';
    updateTrackOrder();

    const formData = new FormData(this);
    formData.append('tracks', JSON.stringify(tracks));

    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const submitBtn = document.querySelector('.submit-btn');

    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    submitBtn.style.display = 'none';
    progressContainer.style.display = 'block';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/submit-release');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
      }
    });

    xhr.onload = function () {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && result.success) {
          progressBar.style.width = '100%';
          progressBar.textContent = 'Upload complete!';
          setTimeout(() => {
            const userAcode = document.body.dataset.userAcode;
            formSubmittedRef.submitted = true;
            window.location.href = `/profile?acode=${userAcode}`;
          }, 800);
        } else {
          showError(result.message || 'Something went wrong');
        }
      } catch (err) {
        console.error('Parse error:', err);
        showError('Unexpected server response.');
      }
    };

    xhr.onerror = () => {
      showError('Network error. Please try again.');
    };

    xhr.send(formData);

    function showError(msg) {
      warningBox.innerHTML = '• ' + msg;
      warningBox.style.display = 'block';
      submitBtn.style.display = 'block';
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
      progressBar.textContent = '0%';
    }
  });
}
