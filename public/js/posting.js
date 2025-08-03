function bindPostFormEvents() {
  const images = document.getElementById('images');
  const videos = document.getElementById('videos');
  const previewContainer = document.getElementById('previewContainer');
  const form = document.querySelector('#postForm');
  const alertBox = document.getElementById('alertBox');
  const alertMessage = document.getElementById('alertMessage');

  if (!form || !images || !videos || !previewContainer) return;

  let selectedFiles = [];

  function updatePreview() {
    previewContainer.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-wrapper';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerText = '✖';
        removeBtn.onclick = () => {
          selectedFiles.splice(index, 1);
          updatePreview();
        };

        const media = document.createElement(file.type.startsWith('video') ? 'video' : 'img');
        media.src = e.target.result;
        if (file.type.startsWith('video')) {
          media.controls = true;
          media.muted = true;
        }

        wrapper.appendChild(removeBtn);
        wrapper.appendChild(media);
        previewContainer.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleFiles(inputFiles, type) {
    const filesArray = Array.from(inputFiles);

    for (let file of filesArray) {
      if (type === 'image') {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} is too large. Max size is 5MB.`);
          continue;
        }
        const imageCount = selectedFiles.filter(f => f.type.startsWith('image/')).length;
        if (imageCount >= 5) {
          alert('You can only upload up to 5 images.');
          return;
        }
        selectedFiles.push(file);
      }

      if (type === 'video') {
        if (!file.type.startsWith('video/')) continue;
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} is too large. Max size is 10MB.`);
          continue;
        }
        const hasVideo = selectedFiles.some(f => f.type.startsWith('video/'));
        if (hasVideo) {
          alert('You can only upload 1 video.');
          return;
        }
        selectedFiles.push(file);
      }
    }

    updatePreview();
  }

  images.addEventListener('change', () => handleFiles(images.files, 'image'));
  videos.addEventListener('change', () => handleFiles(videos.files, 'video'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const dataTransferImages = new DataTransfer();
    const dataTransferVideos = new DataTransfer();

    selectedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        dataTransferImages.items.add(file);
      } else if (file.type.startsWith('video/')) {
        dataTransferVideos.items.add(file);
      }
    });

    document.getElementById('imagesInput').files = dataTransferImages.files;
    document.getElementById('videosInput').files = dataTransferVideos.files;

    const formData = new FormData(form);

    try {
      const response = await fetch('/create-post', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        alertMessage.textContent = result.message;

        alertBox.classList.remove('hidden');
        setTimeout(() => alertBox.classList.add('show'), 10);

        setTimeout(() => {
          alertBox.classList.remove('show');
          setTimeout(() => {
            alertBox.classList.add('hidden');
            window.location.href = '/dashboard';
          }, 400);
        }, 2000);

      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      alert('Network error');
    }
  });
}
