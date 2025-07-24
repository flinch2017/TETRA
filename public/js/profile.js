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
});

