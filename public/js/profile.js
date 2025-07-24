document.addEventListener('DOMContentLoaded', () => {
  const bannerInput = document.getElementById('banner');
  const bannerPreview = document.getElementById('bannerPreview');
  const plusIcon = document.querySelector('.plus-icon');

  // Hide plus icon if bannerPreview already has a source (e.g., when pfpUrl exists)
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
});


document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.artist-dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = toggle.nextElementSibling;
      menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.artist-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const followBtn = document.querySelector('.follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      const targetAcode = followBtn.getAttribute('data-target');
      const isFollowing = followBtn.getAttribute('data-following') === 'true';

      try {
        const url = isFollowing ? '/unfollow' : '/follow';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetAcode })
        });
        const data = await res.json();

        if (data.success) {
          followBtn.textContent = isFollowing ? 'Follow' : 'Following';
          followBtn.setAttribute('data-following', isFollowing ? 'false' : 'true');

          // Optional: update follower count
          const followerCountElem = document.querySelector('.artist-follow');
          if (followerCountElem) {
            let count = parseInt(followerCountElem.textContent) || 0;
            count = isFollowing ? count - 1 : count + 1;
            followerCountElem.textContent = `${count} followers`;
          }
        } else {
          alert(data.message || 'Action failed');
        }
      } catch (err) {
        console.error('Follow/unfollow failed:', err);
        alert('An error occurred');
      }
    });
  }
});





