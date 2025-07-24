


const addTrackBtn = document.getElementById('addTrackBtn');
const tracklistContainer = document.getElementById('tracklistContainer');
const uploadedS3Keys = new Set();
let formSubmitted = false;


const trackOrderInput = document.createElement('input');
trackOrderInput.type = 'hidden';
trackOrderInput.name = 'track_order';
tracklistContainer.appendChild(trackOrderInput);

// Initialize Sortable
const sortable = new Sortable(tracklistContainer, {
  handle: '.drag-handle',
  animation: 150,
  onSort: updateTrackOrder
});

function updateTrackOrder() {
  const cards = Array.from(tracklistContainer.querySelectorAll('.track-card'));
  cards.forEach((card, index) => {
    const num = card.querySelector('.track-number');
    if (num) num.textContent = index + 1;
  });

  const order = cards.map(card => {
    const trackIdField = card.querySelector('input[type="hidden"]'); // get hidden trackId
    return trackIdField ? trackIdField.value : '';
  });
  trackOrderInput.value = order.join(',');
}




function generateUniqueCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function saveUploadedKey(key) { if (key) uploadedS3Keys.add(key); }
function removeUploadedKey(key) { uploadedS3Keys.delete(key); }

const artistAlert = document.getElementById('artistAlert');
function showArtistAlert() {
  artistAlert.style.display = 'flex';
  setTimeout(() => { artistAlert.style.display = 'none'; }, 3000);
}

window.addEventListener('beforeunload', () => {
  if (formSubmitted) return;
  uploadedS3Keys.forEach(key => {
    const data = JSON.stringify({ key });
    const blob = new Blob([data], { type: 'application/json' });
    navigator.sendBeacon('/delete-track', blob);
  });
});


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
    const trackId = `${releaseId}-${generateUniqueCode(8)}`;

    const card = document.createElement('div'); card.className = 'track-card';

    // Container for drag handle + track number
const dragContainer = document.createElement('div');
dragContainer.className = 'drag-container';

// Drag handle (☰)
const dragHandle = document.createElement('div');
dragHandle.className = 'drag-handle';
dragHandle.innerHTML = '&#9776;'; // ☰ icon

// Track order number
const trackNumber = document.createElement('span');
trackNumber.className = 'track-number';
trackNumber.textContent = tracklistContainer.querySelectorAll('.track-card').length + 1;

// Append both to container
dragContainer.appendChild(dragHandle);
dragContainer.appendChild(trackNumber);

// Add to card
card.appendChild(dragContainer);



    const header = document.createElement('div'); header.className = 'track-header';
    const filename = document.createElement('div'); filename.className = 'track-filename'; filename.textContent = file.name;
    const removeBtn = document.createElement('i'); removeBtn.className = 'fas fa-times track-remove';

    removeBtn.addEventListener('click', async () => {
      if (card.dataset.s3Key) {
        await fetch('/delete-track', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ key: card.dataset.s3Key })});
        removeUploadedKey(card.dataset.s3Key);
      }
      tracklistContainer.removeChild(card); tracklistContainer.removeChild(input);
    });

    header.appendChild(filename); header.appendChild(removeBtn); card.appendChild(header);

    // Audio preview
    const preview = document.createElement('div'); preview.className = 'audio-preview';
    const circle = document.createElement('div'); circle.className = 'progress-circle';
    const playBtn = document.createElement('i'); playBtn.className = 'fas fa-play play-btn';
    circle.appendChild(playBtn); preview.appendChild(circle);
    const uploadBar = document.createElement('div'); uploadBar.className = 'upload-progress';
    preview.appendChild(uploadBar); card.appendChild(preview);

    const audio = document.createElement('audio'); audio.src = URL.createObjectURL(file); audio.preload = 'metadata';
    let isPlaying = false;
    playBtn.addEventListener('click', () => isPlaying ? audio.pause() : audio.play());
    audio.addEventListener('play', () => { isPlaying=true; playBtn.classList.replace('fa-play','fa-pause'); });
    audio.addEventListener('pause', () => { isPlaying=false; playBtn.classList.replace('fa-pause','fa-play'); });
    audio.addEventListener('timeupdate', () => {
      const progress = audio.currentTime / audio.duration;
      circle.style.background = `conic-gradient(#007aff ${progress*360}deg, rgba(255,255,255,0.1) ${progress*360}deg)`;
    });

    // Upload
    const xhr = new XMLHttpRequest();
    xhr.open('POST','/upload-track');
    const form = new FormData();
    form.append('track',file); form.append('releaseId',releaseId); form.append('trackId',trackId);
    xhr.upload.onprogress = e => { if(e.lengthComputable){ uploadBar.style.setProperty('--upload-percent',(e.loaded/e.total*100)+'%'); }};
    xhr.onload=()=>{ 
      if(xhr.status===200){ 
        const res=JSON.parse(xhr.responseText); 
        card.dataset.s3Key=res.key; saveUploadedKey(res.key);
      }else{ uploadBar.style.backgroundColor='red'; }
    };
    xhr.send(form);

    // Fields
    const fields=document.createElement('div'); fields.className='track-fields';
    
    const trackIdField = document.createElement('input');
trackIdField.type = 'hidden';
trackIdField.name = 'trackId';
trackIdField.value = trackId;
fields.appendChild(trackIdField);   // ✅ must append so it is included in FormData




    const trackTitleField = document.createElement('input');
trackTitleField.type = 'text';
trackTitleField.placeholder = 'Track Title*';
fields.appendChild(trackTitleField);


    // Primary Artist multi-select
    const primaryContainer=document.createElement('div'); primaryContainer.className='primary-artist-container';
    const primaryInput=document.createElement('input'); primaryInput.type='text'; primaryInput.placeholder='Add Primary Artist*';
    const primarySelectedDiv=document.createElement('div'); primarySelectedDiv.className='selected-artists';
    primaryContainer.appendChild(primaryInput); primaryContainer.appendChild(primarySelectedDiv);
    fields.appendChild(primaryContainer);

    const selectedPrimaryArtists=new Map();
    selectedPrimaryArtists.set(currentUser,'You');

    const hiddenPrimaryAcodesInput = document.createElement('input');
    hiddenPrimaryAcodesInput.type = 'hidden';
    hiddenPrimaryAcodesInput.name = 'primaryArtistAcodes';
    fields.appendChild(hiddenPrimaryAcodesInput);

    function renderPrimarySelected(){
      primarySelectedDiv.innerHTML='';
      selectedPrimaryArtists.forEach((name,acode)=>{
        const span=document.createElement('span'); span.className='artist-capsule'; span.textContent=name;
        if(acode!==currentUser){
          const x=document.createElement('i'); x.className='fas fa-times remove-artist';
          x.onclick=()=>{ selectedPrimaryArtists.delete(acode); renderPrimarySelected(); };
          span.appendChild(x);
        }
        primarySelectedDiv.appendChild(span);
      });
      hiddenPrimaryAcodesInput.value = Array.from(selectedPrimaryArtists.keys()).join(',');
    }
    renderPrimarySelected();

    let primaryDropdown;
    primaryInput.addEventListener('input', async () => {
  const q = primaryInput.value.trim();
  if (!q) { if (primaryDropdown) primaryDropdown.remove(); return; }

  const res = await fetch('/search-artists?q=' + encodeURIComponent(q));
  const list = await res.json();

  if (primaryDropdown) primaryDropdown.remove();
  primaryDropdown = document.createElement('div'); 
  primaryDropdown.className='artist-dropdown';

  let hasResult = false;
  list.forEach(user => {
    const alreadyInPrimary = selectedPrimaryArtists.has(user.acode);
    const alreadyInFeatured = selectedFeaturedArtists.has(user.acode);
    if (!alreadyInPrimary && !alreadyInFeatured) {
      hasResult = true;
      const item=document.createElement('div'); item.className='artist-item';
      const img=document.createElement('img'); img.src=user.pfp_url; img.alt=user.artist_name; img.className='artist-avatar';
      const name=document.createElement('span'); name.textContent=user.artist_name;
      item.appendChild(img); item.appendChild(name);
      item.onclick=()=>{ 
        selectedPrimaryArtists.set(user.acode,user.artist_name); 
        renderPrimarySelected(); 
        primaryInput.value=''; 
        if (primaryDropdown) primaryDropdown.remove(); 
      };
      primaryDropdown.appendChild(item);
    }
  });

  if (!hasResult) {
    const noResultItem = document.createElement('div');
    noResultItem.className = 'no-results-item';
    noResultItem.textContent = 'No results found';
    primaryDropdown.appendChild(noResultItem);
  }

  primaryContainer.appendChild(primaryDropdown);
});

    primaryInput.addEventListener('blur', () => {
  setTimeout(() => {
    if (primaryInput.value.trim()) {
      primaryInput.value = '';
      showArtistAlert();
    }
    if (primaryDropdown) primaryDropdown.remove();
  }, 100);
});


    // Featured Artist multi-select
    const featuredContainer=document.createElement('div'); featuredContainer.className='featured-artist-container';
    const featuredInput=document.createElement('input'); featuredInput.type='text'; featuredInput.placeholder='Add Featured Artist (If any)';
    const featuredSelectedDiv=document.createElement('div'); featuredSelectedDiv.className='selected-featured-artists';
    featuredContainer.appendChild(featuredInput); featuredContainer.appendChild(featuredSelectedDiv);
    fields.appendChild(featuredContainer);

    const selectedFeaturedArtists=new Map();

    const hiddenFeaturedAcodesInput = document.createElement('input');
    hiddenFeaturedAcodesInput.type = 'hidden';
    hiddenFeaturedAcodesInput.name = 'featuredArtistAcodes';
    fields.appendChild(hiddenFeaturedAcodesInput);

    function renderFeaturedSelected(){
      featuredSelectedDiv.innerHTML='';
      selectedFeaturedArtists.forEach((name,acode)=>{
        const span=document.createElement('span'); span.className='artist-capsule'; span.textContent=name;
        const x=document.createElement('i'); x.className='fas fa-times remove-artist';
        x.onclick=()=>{ selectedFeaturedArtists.delete(acode); renderFeaturedSelected(); };
        span.appendChild(x);
        featuredSelectedDiv.appendChild(span);
      });
      hiddenFeaturedAcodesInput.value = Array.from(selectedFeaturedArtists.keys()).join(',');
    }

    let featuredDropdown;
    featuredInput.addEventListener('input', async () => {
  const q = featuredInput.value.trim();
  if (!q) { if (featuredDropdown) featuredDropdown.remove(); return; }

  const res = await fetch('/search-artists?q=' + encodeURIComponent(q));
  const list = await res.json();

  if (featuredDropdown) featuredDropdown.remove();
  featuredDropdown = document.createElement('div'); 
  featuredDropdown.className='artist-dropdown';

  let hasResult = false;
  list.forEach(user => {
    if(user.acode === currentUser) return;
    const alreadyInPrimary = selectedPrimaryArtists.has(user.acode);
    const alreadyInFeatured = selectedFeaturedArtists.has(user.acode);
    if (!alreadyInPrimary && !alreadyInFeatured) {
      hasResult = true;
      const item=document.createElement('div'); item.className='artist-item';
      const img=document.createElement('img'); img.src=user.pfp_url; img.alt=user.artist_name; img.className='artist-avatar';
      const name=document.createElement('span'); name.textContent=user.artist_name;
      item.appendChild(img); item.appendChild(name);
      item.onclick=()=>{ 
        selectedFeaturedArtists.set(user.acode,user.artist_name); 
        renderFeaturedSelected(); 
        featuredInput.value=''; 
        if (featuredDropdown) featuredDropdown.remove(); 
      };
      featuredDropdown.appendChild(item);
    }
  });

  if (!hasResult) {
    const noResultItem = document.createElement('div');
    noResultItem.className = 'no-results-item';
    noResultItem.textContent = 'No results found';
    featuredDropdown.appendChild(noResultItem);
  }

  featuredContainer.appendChild(featuredDropdown);
});

    featuredInput.addEventListener('blur', () => {
  setTimeout(() => {
    if (featuredInput.value.trim()) {
      featuredInput.value = '';
      showArtistAlert();
    }
    if (featuredDropdown) featuredDropdown.remove();
  }, 100);
});


    // Other fields

// Genre dropdown
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

// Sub-Genre dropdown
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


// Composer text input
const composerInput = document.createElement('input');
composerInput.type = 'text';
composerInput.placeholder = 'Composer*';
fields.appendChild(composerInput);

// Producer text input
const producerInput = document.createElement('input');
producerInput.type = 'text';
producerInput.placeholder = 'Producer*';
fields.appendChild(producerInput);

// ISRC text input
const isrcInput = document.createElement('input');
isrcInput.type = 'text';
isrcInput.placeholder = 'ISRC (If available)';
isrcInput.name = 'isrc';
fields.appendChild(isrcInput);


// BPM text input
const bpmInput = document.createElement('input');
bpmInput.type = 'number';
bpmInput.placeholder = 'BPM*';
bpmInput.min = '30';
bpmInput.max = '300';
fields.appendChild(bpmInput);


// Mood dropdown
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

// Explicit dropdown
const explicitSelect = document.createElement('select');
explicitSelect.name = 'explicit';
explicitSelect.innerHTML = `
  <option value="" disabled selected hidden>Is the track explicit?*</option>
  <option value="Yes">Yes</option>
  <option value="Not Explicit">Not Explicit</option>
  <option value="Clean Version">Clean Version</option>
`;
fields.appendChild(explicitSelect);




    header.onclick=e=>{ if(!e.target.classList.contains('track-remove')) fields.style.display=fields.style.display==='none'?'block':'none'; };
    card.appendChild(fields);
    tracklistContainer.appendChild(card);
  });
  tracklistContainer.appendChild(input); input.click();
});

const releaseForm = document.querySelector('form'); // adjust selector if needed
if (releaseForm) {
  releaseForm.addEventListener('submit', () => {
    formSubmitted = true;
  });
}


const canvasUpload = document.getElementById('canvasUpload');
const canvasInput = document.getElementById('canvasInput');
const canvasPreview = document.getElementById('canvasPreview');
const canvasPlusIcon = canvasUpload.querySelector('.plus-icon'); // renamed

// Clicking the placeholder triggers file input
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

    // Passed validation — show preview
    const previewURL = URL.createObjectURL(file);
    canvasPreview.src = previewURL;
    canvasPreview.style.display = 'block';
    canvasPreview.play();   // autoplay preview
    canvasPlusIcon.style.display = 'none'; // updated reference
  };

  video.onerror = () => {
    alert('Could not load video. Please upload a valid MP4 file.');
    canvasInput.value = '';
  };

  video.src = URL.createObjectURL(file);
});

const artworkUpload = document.getElementById('artworkUpload');
const artworkInput = document.getElementById('artworkInput');
const artworkPreview = document.getElementById('artworkPreview');
const plusIcon = artworkUpload.querySelector('.plus-icon');

artworkUpload.addEventListener('click', () => {
  artworkInput.click();
});

artworkInput.addEventListener('change', () => {
  const file = artworkInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      artworkPreview.src = e.target.result;
      artworkPreview.style.display = 'block';
      plusIcon.style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    artworkPreview.src = '';
    artworkPreview.style.display = 'none';
    plusIcon.style.display = 'block';
  }
});

document.getElementById('releaseForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  let messages = [];

  // Validate main form fields
  const artwork = document.querySelector('#artworkInput').files.length;
  if (!artwork) messages.push('• Please upload artwork.');
  const releaseTitle = document.querySelector('input[name="release_title"]').value.trim();
  if (!releaseTitle) messages.push('• Please enter Release Title.');
  const releaseDate = document.querySelector('input[name="release_date"]').value;
  if (!releaseDate) messages.push('• Please select Release Date.');
  const releaseTime = document.querySelector('input[name="release_time"]').value;
  if (!releaseTime) messages.push('• Please select Release Time.');
  const releaseZone = document.querySelector('select[name="release_zone"]').value;
  if (!releaseZone) messages.push('• Please select Timezone.');

  const upc = document.querySelector('input[name="upc"]')?.value?.trim();
  if (!upc) messages.push('• Please enter UPC.');

  // Validate tracks
  const trackCards = document.querySelectorAll('#tracklistContainer .track-card');
  if (trackCards.length === 0) {
    messages.push('• Please add at least one track.');
  }

  const tracks = [];
  const isrcs = [];
  trackCards.forEach((card, index) => {
    const title = card.querySelector('input[placeholder="Track Title*"]').value.trim();
    const primaryArtistAcodes = card.querySelector('input[name="primaryArtistAcodes"]').value.trim();
    const genre = card.querySelector('select[name="genre"]').value;
    const subGenre = card.querySelector('select[name="subGenre"]').value;
    const composer = card.querySelector('input[placeholder="Composer*"]').value.trim();
    const producer = card.querySelector('input[placeholder="Producer*"]').value.trim();
    const bpm = card.querySelector('input[placeholder="BPM*"]').value.trim();
    const mood = card.querySelector('select[name="mood"]').value;
    const explicit = card.querySelector('select[name="explicit"]').value;
    const trackId = card.querySelector('input[name="trackId"]')?.value;
    const featuredArtistAcodes = card.querySelector('input[name="featuredArtistAcodes"]').value.trim();
    const isrc = card.querySelector('input[name="isrc"]')?.value?.trim();
    const s3Key = card.dataset.s3Key;

    if (!title) messages.push(`• Track ${index + 1}: Please enter Track Title.`);
    if (!primaryArtistAcodes) messages.push(`• Track ${index + 1}: Please add at least one Primary Artist.`);
    if (!genre) messages.push(`• Track ${index + 1}: Please select Genre.`);
    if (!subGenre) messages.push(`• Track ${index + 1}: Please select Sub-Genre.`);
    if (!composer) messages.push(`• Track ${index + 1}: Please enter Composer.`);
    if (!producer) messages.push(`• Track ${index + 1}: Please enter Producer.`);
    if (!bpm) messages.push(`• Track ${index + 1}: Please enter BPM.`);
    if (!mood) messages.push(`• Track ${index + 1}: Please select Mood.`);
    if (!explicit) messages.push(`• Track ${index + 1}: Please select if track is Explicit.`);
    if (isrc) isrcs.push(isrc);

    tracks.push({
      trackId, title, primaryArtistAcodes, featuredArtistAcodes, genre, subGenre, composer, producer, bpm, mood, explicit, isrc, s3Key
    });
  });

  // ✅ Extra warning if there is only one track and titles differ
  if (trackCards.length === 1) {
    const trackTitle = tracks[0].title;
    if (trackTitle.toLowerCase() !== releaseTitle.toLowerCase()) {
      messages.push('• You have only added one track. Please make sure the Release Title and Track Title match (they currently do not).');
    }
  }

  // NEW: Check ISRC & UPC duplicates
  if (isrcs.length > 0 || upc) {
    try {
      const duplicateResponse = await fetch('/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isrcs, upc })
      });
      const duplicateResult = await duplicateResponse.json();
      if (duplicateResult.duplicateISRCs && duplicateResult.duplicateISRCs.length > 0) {
        duplicateResult.duplicateISRCs.forEach(d => {
          messages.push(`• The ISRC "${d}" already exists in the system.`);
        });
      }
      if (duplicateResult.duplicateUPC) {
        messages.push(`• The UPC "${upc}" already exists in the system.`);
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
      messages.push('• Could not verify ISRC/UPC duplicates. Please try again later.');
    }
  }

  // Show warnings if any
  const warningBox = document.getElementById('releaseWarnings');
  if (messages.length > 0) {
    warningBox.innerHTML = messages.join('<br>');
    warningBox.style.display = 'block';
    window.scrollTo({ top: warningBox.offsetTop - 20, behavior: 'smooth' });
    return;
  } else {
    warningBox.style.display = 'none';
  }

  // ✅ If validation passed, send data
  updateTrackOrder();
  const formData = new FormData(this);
  formData.append('tracks', JSON.stringify(tracks));

    try {
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const submitBtn = document.querySelector('.submit-btn');

  // Reset & show progress, hide button
  progressBar.style.width = '0%';
  progressBar.textContent = '0%';
  submitBtn.style.display = 'none';
  progressContainer.style.display = 'block';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/submit-release');

  xhr.upload.addEventListener('progress', function(e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percent + '%';
      progressBar.textContent = percent + '%';
    }
  });

  xhr.onload = function() {
    try {
      const result = JSON.parse(xhr.responseText);
      if (xhr.status === 200 && result.success) {
        progressBar.style.width = '100%';
        progressBar.textContent = 'Upload complete!';
        setTimeout(() => {
          const userAcode = document.body.dataset.userAcode;
            window.location.href = `/profile?acode=${userAcode}`;

        }, 800); // brief pause to show completion
      } else {
        showError(result.message || 'Something went wrong');
      }
    } catch (parseErr) {
      console.error('Parse error:', parseErr);
      showError('Unexpected server response.');
    }
  };

  xhr.onerror = function() {
    showError('Network error. Please try again.');
  };

  xhr.send(formData);

  function showError(message) {
    warningBox.innerHTML = '• ' + message;
    warningBox.style.display = 'block';
    submitBtn.style.display = 'block';
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
  }
} catch (error) {
  console.error('Submit error:', error);
  warningBox.innerHTML = '• Server error. Please try again later.';
  warningBox.style.display = 'block';
  submitBtn.style.display = 'block';
  progressContainer.style.display = 'none';
  progressBar.style.width = '0%';
  progressBar.textContent = '0%';
}


});
