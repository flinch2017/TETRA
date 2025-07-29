
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
    drawer.classList.toggle('expanded');
    drawer.classList.toggle('collapsed');
    plusButton.classList.toggle('up');
    plusOptions.style.display = 'none';
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

  function updateUIAndPlay({ title, artist, coverUrl, audioUrl, track_id }) {
  // Collapsed bar updates
  document.getElementById('currentTrackTitle').textContent = title;
  document.getElementById('currentArtist').textContent = artist;
  document.getElementById('currentArtwork').src = coverUrl || '/default/disc_default.png';

  // Expanded view updates
  document.getElementById('expandedTrackTitle').textContent = title;
  document.getElementById('expandedArtist').textContent = artist;
  document.getElementById('albumArt').src = coverUrl || '/default/disc_default.png';

  // Audio
  const audio = document.getElementById('audioPlayer');
  audio.src = audioUrl;

  streamTrackId = track_id;
  isOrganic = true;

  audio.play().catch(err => {
    console.error('Autoplay failed:', err);
  });
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
  isOrganic = true;
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



  playPauseBtn.addEventListener('click', togglePlayback);
  playPauseBtnExpanded.addEventListener('click', togglePlayback);

  // Optional next/prev logic
  const songQueue = []; // Add song IDs here when building playlist
  let currentIndex = -1;

  function playNext() {
    if (songQueue.length && currentIndex < songQueue.length - 1) {
      currentIndex++;
      fetchAndPlay(songQueue[currentIndex]);
    }
  }

  function playPrev() {
    if (songQueue.length && currentIndex > 0) {
      currentIndex--;
      fetchAndPlay(songQueue[currentIndex]);
    }
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
      coverUrl: document.getElementById('currentArtwork').src,
    }
  };
  localStorage.setItem('playerState', JSON.stringify(state));
});

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('playerState');
  if (!saved) return;

  const { src, currentTime, isPlaying, metadata } = JSON.parse(saved);

  audio.src = src;
  audio.currentTime = currentTime || 0;

  // Update UI
  document.getElementById('currentTrackTitle').textContent = metadata.title;
  document.getElementById('currentArtist').textContent = metadata.artist;
  document.getElementById('currentArtwork').src = metadata.coverUrl;
  document.getElementById('expandedTrackTitle').textContent = metadata.title;
  document.getElementById('expandedArtist').textContent = metadata.artist;
  document.getElementById('albumArt').src = metadata.coverUrl;

  // Optionally wait a bit before playing to avoid race conditions
  if (isPlaying) {
    setTimeout(() => audio.play().catch(console.error), 500);
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


// Like toggle
likeBtn.addEventListener('click', () => {
  isLiked = !isLiked;
  likeIcon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
  likeIcon.style.color = isLiked ? '#e74c3c' : '';
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
