




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



  document.getElementById('editArtistForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    try {
      const response = await fetch('/update-artist', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        alert('Profile updated successfully!');
        window.location.href = '/profile';   // redirect after success
      } else {
        alert('Update failed: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('AJAX error:', err);
      alert('An error occurred.');
    }
  });
