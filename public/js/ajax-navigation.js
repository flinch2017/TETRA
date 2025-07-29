document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;

    if (href === '/logout') {
  e.preventDefault();
  handleLogout(href);
  return;
}

if (
  href === '/login' ||
  href.startsWith('/submission')
) return;


    e.preventDefault();

    try {
      const res = await fetch(href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) throw new Error('Failed to fetch page');

      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newContent = doc.querySelector('#appContent');

      if (newContent) {
        document.querySelector('#appContent').innerHTML = newContent.innerHTML;
        
        // ✅ Force scroll to top
        window.scrollTo(0, 0);
        
        window.history.pushState({}, '', href);
        bindAllPageEvents(); // already enough
      }

    } catch (err) {
      console.error('AJAX navigation failed:', err);
      window.location.href = href; // fallback
    }
  });

  window.addEventListener('popstate', async () => {
  try {
    const res = await fetch(location.href, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    if (!res.ok) throw new Error('Failed to fetch page');

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let newContent = doc.querySelector('#appContent');

    if (!newContent) {
      // Fallback: treat response as partial
      newContent = document.createElement('div');
      newContent.innerHTML = html;
    }

    document.querySelector('#appContent').innerHTML = newContent.innerHTML;
    window.scrollTo(0, 0);
    bindAllPageEvents();
  } catch (err) {
    console.error('popstate failed:', err);
    location.reload();
  }
});


});


function bindAjaxLinks() {
  document.querySelectorAll('a.ajax-link').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const url = this.href;

      fetch(url)
        .then(res => res.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newContent = doc.getElementById('appContent').innerHTML;
          document.getElementById('appContent').innerHTML = newContent;

          history.pushState(null, '', url);

          // 🔁 THIS is what was missing 👇
          bindAllPageEvents();
        });
    });
  });
}


function bindSongClickEvents() {
  document.querySelectorAll('.song-item').forEach(item => {
    item.addEventListener('click', async function () {
      const songId = this.dataset.songId;
      if (!songId) return;

      try {
        const res = await fetch(`/api/song-info/${songId}`);
        const data = await res.json();
        if (!data.audioUrl) return alert('Song unavailable.');

        updateUIAndPlay(data); // 👈 Use your existing music player logic
      } catch (err) {
        console.error('Error playing song:', err);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindAjaxLinks();
  bindSongClickEvents(); // Initial bind
});




document.addEventListener('DOMContentLoaded', () => {
  bindAllPageEvents(); // Bind everything on initial load
});




function bindLikeButtons() {
  document.querySelectorAll('.like-track').forEach(icon => {
    icon.addEventListener('click', async (e) => {
      e.stopPropagation(); // prevent triggering song play
      const i = e.currentTarget;
      const trackId = i.dataset.trackId;
      const isLiked = i.dataset.liked === 'true';

      // Optimistic UI
      i.classList.toggle('fas', !isLiked);
      i.classList.toggle('far', isLiked);
      i.style.color = !isLiked ? '#2196f3' : '';
      i.dataset.liked = (!isLiked).toString();

      try {
        await fetch('/api/like-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track_id: trackId,
            liked: !isLiked
          })
        });
      } catch (err) {
        console.error('Failed to toggle like:', err);
      }
    });
  });
}

function showFloatingMessage(message, type = 'success') {
  const msgBox = document.getElementById('floatingMessage');
  msgBox.textContent = message;
  msgBox.className = `floating-message show ${type}`;

  // Show then hide after 3 seconds
  setTimeout(() => {
    msgBox.classList.remove('show');
  }, 3000);
}


function bindEllipsisToggles() {
  document.querySelectorAll('.toggle-details').forEach(button => {
    button.addEventListener('click', e => {
      e.stopPropagation();
      const targetId = button.dataset.target;
      const detailEl = document.getElementById(`details-${targetId}`);
      detailEl.classList.toggle('visible');
    });
  });
}


function handleLogout(href) {
  // Stop audio
  const audio = document.getElementById('audioPlayer');
  if (audio) {
    audio.pause();
    audio.src = '';
    audio.load();
  }

  // Reset UI elements
  const titleEl = document.getElementById('currentTrackTitle');
  const artistEl = document.getElementById('currentArtist');
  const artEl = document.getElementById('currentArtwork');
  const expTitleEl = document.getElementById('expandedTrackTitle');
  const expArtistEl = document.getElementById('expandedArtist');
  const expArtEl = document.getElementById('albumArt');

  if (titleEl) titleEl.textContent = '';
  if (artistEl) artistEl.textContent = '';
  if (artEl) artEl.src = '/drawables/disc_default.png';
  if (expTitleEl) expTitleEl.textContent = '';
  if (expArtistEl) expArtistEl.textContent = '';
  if (expArtEl) expArtEl.src = '/drawables/disc_default.png';

  // Hide the drawer
  const drawer = document.getElementById('musicDrawer');
  if (drawer) {
    drawer.style.display = 'none';
    drawer.classList.remove('expanded');
    drawer.classList.add('collapsed');
  }

  // Clear player state
  localStorage.removeItem('playerState');

  // Redirect to logout URL
  window.location.href = href;
}






function bindAllPageEvents() {
  bindSongClickEvents();
  initFollowButton();
  bindDropdownToggles();
  bindProfileEvents();
  bindPostActionButtons();
  bindLikeButtons(); 
  bindFormSubmissions();

  // 👇 ADD THIS:
  bindEllipsisToggles();

  if (typeof bindSongClickHandlers === 'function') {
    bindSongClickHandlers();
  }
}



