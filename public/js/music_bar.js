
  const drawer = document.getElementById('musicDrawer');
  
  const bar = drawer.querySelector('.music-bar');
  const plusButton = document.getElementById('plusButton');
  const plusOptions = document.getElementById('plusOptions');
  const releaseLink = document.getElementById('releaseLink');
  const releaseModal = document.getElementById('releaseModal');
  const closeModal = releaseModal.querySelector('.close');
  let streamTrackId = null;
let isOrganic = true;

  bar.addEventListener('click', () => {
  const isNowExpanded = drawer.classList.toggle('expanded');
  drawer.classList.toggle('collapsed');
  plusButton.classList.toggle('up');
  plusOptions.style.display = 'none';

  // Use CSS class to hide/show smoothly
  if (isNowExpanded) {
    plusButton.classList.add('hidden');
  } else {
    plusButton.classList.remove('hidden');
  }
});



  plusButton.addEventListener('click', (e) => {
    e.stopPropagation();
    plusOptions.style.display = (plusOptions.style.display === 'flex') ? 'none' : 'flex';
  });

  document.addEventListener('click', () => {
    plusOptions.style.display = 'none';
  });

  releaseLink.addEventListener('click', (e) => {
    e.stopPropagation();
    plusOptions.style.display = 'none';
    releaseModal.style.display = 'block';

    const content = releaseModal.querySelector('.modal-content');
    content.style.animation = 'none';
    void content.offsetWidth;
    content.style.animation = 'popIn 0.3s ease forwards';
  });

  closeModal.addEventListener('click', () => {
    releaseModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === releaseModal) {
      releaseModal.style.display = 'none';
    }
  });

  document.querySelectorAll('.clickable-song').forEach(item => {
    item.addEventListener('click', async (e) => {
  const clickedItem = e.currentTarget;
  const songId = clickedItem.dataset.songId;
  try {
    const res = await fetch(`/api/song-info/${songId}`);
    const data = await res.json();
    updateUIAndPlay(data, clickedItem);  // 👈 pass the DOM node
  } catch (err) {
    console.error('Failed to fetch song:', err);
  }
});

  });

function updateDrawerVisibility() {
  const hasTrack = !!audio.src && audio.src.trim() !== '';
  drawer.style.display = hasTrack ? 'block' : 'none';
}





  function updateUIAndPlay({ title, artist, coverUrl, audioUrl, canvasUrl, track_id, isLiked: likedStatusFromServer }, clickedElement = null) {
  drawer.style.display = 'block';

  document.getElementById('currentTrackTitle').textContent = title;
  document.getElementById('currentArtist').textContent = artist;
  document.getElementById('currentArtwork').src = coverUrl?.trim() ? coverUrl : '/drawables/disc_default.png';
  document.getElementById('expandedTrackTitle').textContent = title;
  document.getElementById('expandedArtist').textContent = artist;
  document.getElementById('albumArt').src = coverUrl?.trim() ? coverUrl : '/drawables/disc_default.png';




   // Handle canvas and cover fallback
const canvasVideo = document.getElementById('canvasVideo');
const albumArt = document.getElementById('albumArt');

if (canvasUrl && canvasUrl.trim()) {
  canvasVideo.src = canvasUrl;
  canvasVideo.style.display = 'block';
  albumArt.style.visibility = 'hidden'; // ✅ keeps its size
} else {
  canvasVideo.removeAttribute('src');
  canvasVideo.style.display = 'none';
  albumArt.style.visibility = 'visible';
}



  audio.src = audioUrl;
  streamTrackId = track_id;
  isOrganic = true;

  // 🔥 Use localStorage liked state if available
  const saved = localStorage.getItem('playerState');
  let likedFromLocal = null;
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.likedTracks && typeof parsed.likedTracks[track_id] !== 'undefined') {
      likedFromLocal = parsed.likedTracks[track_id];
    }
  }

  isLiked = (likedFromLocal !== null) ? likedFromLocal : likedStatusFromServer;
  likeIcon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
  likeIcon.style.color = isLiked ? '#00BFFF' : '';

  audio.play().catch(err => {
    console.error('Autoplay failed:', err);
  });

  updateDrawerVisibility();

  // Update queue
  songQueue.length = 0;
  document.querySelectorAll('.clickable-song').forEach((el, index) => {
    const id = el.dataset.songId;
    songQueue.push(id);

    if (clickedElement && el === clickedElement) {
      currentIndex = index;
    }
  });

  if (!clickedElement) {
    const fallbackIndex = songQueue.findIndex(id => id === track_id);
    if (fallbackIndex !== -1) currentIndex = fallbackIndex;
  }
}






  const audio = document.getElementById('audioPlayer');
  const seekbar = document.getElementById('seekbar');

  // Update seekbar as the audio plays
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    seekbar.value = percent;
  });

  // Allow user to seek manually
  seekbar.addEventListener('input', () => {
    if (!audio.duration) return;
    const time = (seekbar.value / 100) * audio.duration;
    audio.currentTime = time;
  });

  audio.addEventListener('seeking', () => {
  isOrganic = false;
});

audio.addEventListener('pause', () => {
  if (!audio.ended) {
    isOrganic = false;
  }
});

audio.addEventListener('ended', () => {
  if (streamTrackId && isOrganic) {
    fetch('/api/log-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: streamTrackId })
    }).catch(err => console.warn('Failed to log stream:', err));
  }

  streamTrackId = null;

  // 🔁 Handle repeat behavior
  if (repeatMode === 'one') {
    isOrganic = false; // 👈 Mark this looped play as non-organic
    audio.currentTime = 0;
    audio.play().catch(console.error);
  } else if (repeatMode === 'all' || (currentIndex + 1 < songQueue.length)) {
    isOrganic = true;
    playNext(); // this already respects shuffle and repeat all
  } else {
    isOrganic = true;
    updateDrawerVisibility();
  }
});



  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseBtnExpanded = document.getElementById('playPauseBtnExpanded');
  const nextBtn = document.getElementById('nextBtn');
  const nextBtnExpanded = document.getElementById('nextBtnExpanded');
  const prevBtn = document.getElementById('prevBtn');

  const currentTimeDisplay = document.getElementById('currentTime');
  const totalDurationDisplay = document.getElementById('totalDuration');


  // Prevent drawer from expanding when control buttons are clicked
[playPauseBtn, playPauseBtnExpanded, nextBtn, nextBtnExpanded, prevBtn].forEach(btn => {
  btn.addEventListener('click', e => e.stopPropagation());
});


 function togglePlayback() {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
  updatePlayPauseIcons();
}

function updatePlayPauseIcons() {
  const isPlaying = !audio.paused;
  const icon = isPlaying ? '/drawables/paused_default.png' : '/drawables/play_default.png';

  document.getElementById('playPauseIcon').src = icon;
  document.getElementById('playPauseIconExpanded').src = icon;

  // Optionally update alt text too
  document.getElementById('playPauseIcon').alt = isPlaying ? 'Pause' : 'Play';
  document.getElementById('playPauseIconExpanded').alt = isPlaying ? 'Pause' : 'Play';
}


audio.addEventListener('play', updatePlayPauseIcons);
audio.addEventListener('pause', updatePlayPauseIcons);
audio.addEventListener('pause', updateDrawerVisibility);
audio.addEventListener('ended', updateDrawerVisibility);
audio.addEventListener('play', updateDrawerVisibility);




  playPauseBtn.addEventListener('click', togglePlayback);
  playPauseBtnExpanded.addEventListener('click', togglePlayback);

  // Optional next/prev logic
  const songQueue = []; // Add song IDs here when building playlist
  let currentIndex = -1;

  function playNext() {
  if (!songQueue.length) return;
  const nextIndex = getNextTrackIndex(currentIndex, songQueue);
  if (nextIndex >= songQueue.length) return; // Out of bounds
  currentIndex = nextIndex;
  fetchAndPlay(songQueue[currentIndex]);
}

function playPrev() {
  if (!songQueue.length) return;
  if (audio.currentTime > 5) {
    audio.currentTime = 0;
    return;
  }
  currentIndex = (currentIndex - 1 + songQueue.length) % songQueue.length;
  fetchAndPlay(songQueue[currentIndex]);
}


  nextBtn.addEventListener('click', playNext);
  nextBtnExpanded.addEventListener('click', playNext);
  prevBtn.addEventListener('click', playPrev);

  function fetchAndPlay(songId) {
    fetch(`/api/song-info/${songId}`)
      .then(res => res.json())
      .then(updateUIAndPlay)
      .catch(err => console.error('Failed to load song:', err));
  }

  // Format time (e.g., 90 → "1:30")
  function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  audio.addEventListener('loadedmetadata', () => {
    totalDurationDisplay.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    seekbar.value = percent;
    currentTimeDisplay.textContent = formatTime(audio.currentTime);
  });

window.addEventListener('beforeunload', () => {
  const state = {
    src: audio.src,
    currentTime: audio.currentTime,
    isPlaying: !audio.paused,
    metadata: {
      title: document.getElementById('currentTrackTitle').textContent,
      artist: document.getElementById('currentArtist').textContent,
      coverUrl: document.getElementById('currentArtwork').getAttribute('src'),
    },
    queue: songQueue,
    currentIndex,
    repeatMode,
    isShuffling,
    isLiked
  };
  localStorage.setItem('playerState', JSON.stringify(state));
});


window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('playerState');
  if (!saved) return;

  const { src, currentTime, isPlaying, metadata, queue, currentIndex: savedIndex, repeatMode: savedRepeat, isShuffling: savedShuffle, isLiked: savedLike } = JSON.parse(saved);

  // Restore audio
  audio.src = src;
  audio.currentTime = currentTime || 0;

    // ✅ Set streamTrackId so like/unlike can work after reload
  if (Array.isArray(queue) && typeof savedIndex === 'number') {
    streamTrackId = queue[savedIndex];
  }


  // Restore UI
  document.getElementById('currentTrackTitle').textContent = metadata.title;
  document.getElementById('currentArtist').textContent = metadata.artist;
  document.getElementById('currentArtwork').src = metadata.coverUrl;
  document.getElementById('expandedTrackTitle').textContent = metadata.title;
  document.getElementById('expandedArtist').textContent = metadata.artist;
  document.getElementById('albumArt').src = metadata.coverUrl;

  // ✅ Restore like state
  isLiked = savedLike; // 👈 SET LIKE STATE
  likeIcon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
  likeIcon.style.color = isLiked ? '#00BFFF' : '';

  // ✅ Restore queue state
  if (Array.isArray(queue)) songQueue.push(...queue);
  if (typeof savedIndex === 'number') currentIndex = savedIndex;
  if (typeof savedRepeat === 'string') repeatMode = savedRepeat;
  if (typeof savedShuffle === 'boolean') isShuffling = savedShuffle;

  shuffleBtn.classList.toggle('active', isShuffling);
  shuffleBtn.querySelector('i').style.color = isShuffling ? '#1DB954' : '';

  if (repeatMode === 'off') {
    repeatIcon.className = 'fas fa-repeat';
    repeatIcon.style.color = '';
    repeatIcon.removeAttribute('data-one');
  } else if (repeatMode === 'all') {
    repeatIcon.className = 'fas fa-repeat';
    repeatIcon.style.color = '#1DB954';
    repeatIcon.removeAttribute('data-one');
  } else if (repeatMode === 'one') {
    repeatIcon.className = 'fas fa-repeat';
    repeatIcon.style.color = '#1DB954';
    repeatIcon.setAttribute('data-one', 'true');
  }

  if (isPlaying) {
    setTimeout(() => {
      audio.play().catch(console.error);
      updateDrawerVisibility();
    }, 500);
  } else {
    updateDrawerVisibility();
  }
  
});



function bindSongClickHandlers() {
  document.querySelectorAll('.clickable-song').forEach(item => {
    item.addEventListener('click', async () => {
      const songId = item.dataset.songId;
      try {
        const res = await fetch(`/api/song-info/${songId}`);
        const data = await res.json();
        updateUIAndPlay(data);
      } catch (err) {
        console.error('Failed to fetch song:', err);
      }
    });
  });
}

// Initial bind
bindSongClickHandlers();

// Re-bind after AJAX navigation replaces #appContent
window.addEventListener('page:loaded', () => {
  bindSongClickHandlers();
});



let isShuffling = false;
let repeatMode = 'off'; // 'off', 'all', 'one'
let isLiked = false;

const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const likeBtn = document.getElementById('likeBtn');
const repeatIcon = document.getElementById('repeatIcon');
const likeIcon = document.getElementById('likeIcon');

// Shuffle toggle
shuffleBtn.addEventListener('click', () => {
  isShuffling = !isShuffling;
  shuffleBtn.classList.toggle('active', isShuffling);
  shuffleBtn.querySelector('i').style.color = isShuffling ? '#1DB954' : '';
});

repeatBtn.addEventListener('click', () => {
  if (repeatMode === 'off') {
    repeatMode = 'all';
    repeatIcon.className = 'fas fa-repeat';
    repeatIcon.style.color = '#1DB954';
    repeatIcon.removeAttribute('data-one');
  } else if (repeatMode === 'all') {
    repeatMode = 'one';
    repeatIcon.className = 'fas fa-repeat';
    repeatIcon.style.color = '#1DB954';
    repeatIcon.setAttribute('data-one', 'true');
  } else {
    repeatMode = 'off';
    repeatIcon.className = 'fas fa-repeat';
    repeatIcon.style.color = '';
    repeatIcon.removeAttribute('data-one');
  }
});


likeBtn.addEventListener('click', async () => {
  if (!streamTrackId) return;

  const likedNow = !isLiked;

  // Update UI optimistically
  likeIcon.className = likedNow ? 'fas fa-heart' : 'far fa-heart';
  likeIcon.style.color = likedNow ? '#00BFFF' : '';
  isLiked = likedNow;

  try {
    await fetch('/api/like-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_id: streamTrackId,
        liked: likedNow
      })
    });

    // ✅ Update localStorage here after successful toggle
    const saved = localStorage.getItem('playerState');
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.likedTracks = parsed.likedTracks || {};
parsed.likedTracks[streamTrackId] = isLiked;

      localStorage.setItem('playerState', JSON.stringify(parsed));
    }

  } catch (err) {
    console.error('Error updating like status:', err);
    // Rollback
    likeIcon.className = isLiked ? 'far fa-heart' : 'fas fa-heart';
    likeIcon.style.color = isLiked ? '' : '#00BFFF';
    isLiked = !likedNow;
  }
});




function getNextTrackIndex(currentIndex, playlist) {
  if (repeatMode === 'one') return currentIndex;

  if (isShuffling) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * playlist.length);
    } while (randomIndex === currentIndex);
    return randomIndex;
  }

  if (repeatMode === 'all') {
    return (currentIndex + 1) % playlist.length;
  }

  return currentIndex + 1;
}

