export function setupArtworkUpload() {
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
}
