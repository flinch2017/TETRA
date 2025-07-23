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
