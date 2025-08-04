function bindProfileEvents() {
  const bannerInput = document.getElementById('banner');
  const bannerPreview = document.getElementById('bannerPreview');
  const plusIcon = document.querySelector('.plus-icon');

  if (bannerPreview && bannerPreview.src && bannerPreview.src.trim() !== '' && bannerPreview.style.display !== 'none') {
    if (plusIcon) plusIcon.style.display = 'none';
  }

  if (bannerInput) {
    bannerInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        bannerPreview.src = URL.createObjectURL(file);
        bannerPreview.style.display = 'block';
        if (plusIcon) plusIcon.style.display = 'none';
      }
    });
  }

  document.querySelectorAll('.more-dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = toggle.nextElementSibling;
      menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.more-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });
}



  

  function bindFormSubmissions() {
  const editForm = document.getElementById('editArtistForm');

  if (editForm && !editForm.dataset.bound) {
    editForm.dataset.bound = 'true';

    editForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(editForm);

      try {
        const response = await fetch('/update-artist', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (response.ok) {
          showFloatingMessage('Profile updated successfully!', 'success');
          setTimeout(() => {
            window.location.href = '/profile';
          }, 1200); // give time for message to show
        } else {
          showFloatingMessage('Update failed: ' + (result.message || 'Unknown error'), 'error');
        }
      } catch (err) {
        console.error('AJAX error:', err);
        showFloatingMessage('An error occurred while submitting.', 'error');
      }
    });
  }
}

function bindArtistTabNavigation() {
  const tabs = document.querySelectorAll('.artist-tab');
  const tabContents = {
    songs: document.getElementById('songsTabContent'),
    posts: document.getElementById('postsTabContent'),
    store: document.getElementById('storeTabContent')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const selectedTab = tab.dataset.tab;

      for (const [key, content] of Object.entries(tabContents)) {
        content.style.display = (key === selectedTab) ? 'block' : 'none';
      }
    });
  });
}


function bindProfilePostClickEvents() {
  document.querySelectorAll('.clickable-post').forEach(postEl => {
    postEl.addEventListener('click', function () {
      const postId = postEl.dataset.postId;
      if (!postId) return;

      const url = `/post?postId=${postId}`;
      
      // Use AJAX navigation manually
      fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(res => res.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newContent = doc.querySelector('#appContent');

          if (newContent) {
            document.querySelector('#appContent').innerHTML = newContent.innerHTML;
            window.scrollTo(0, 0);
            window.history.pushState({}, '', url);
            bindAllPageEvents();
          } else {
            // fallback full redirect
            window.location.href = url;
          }
        })
        .catch(() => window.location.href = url);
    });
  });
}



