document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;

    // ✅ Skip AJAX for logout, login, submission, home
    if (
      href === '/logout' ||
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
      const res = await fetch(location.href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newContent = doc.querySelector('#appContent');
      if (newContent) {
        document.querySelector('#appContent').innerHTML = newContent.innerHTML;
        bindAllPageEvents(); // already enough



      }
    } catch {
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

window.addEventListener('popstate', () => {
  location.reload(); // Optional: full reload on back/forward
});


document.addEventListener('DOMContentLoaded', () => {
  bindAllPageEvents(); // Bind everything on initial load
});







function bindAllPageEvents() {
  bindSongClickEvents();
  initFollowButton();
  bindDropdownToggles(); // you’ll define this next
  bindProfileEvents();   // for banner image preview and more menu
  bindPostActionButtons(); // ← Add this if not yet done
}
