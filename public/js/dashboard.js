function bindPostActionButtons() {
  document.querySelectorAll('.post-actions button[title="Like"]').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('Liked a post');
    });
  });

  document.querySelectorAll('.post-actions button[title="Comment"]').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('Comment clicked');
    });
  });

  document.querySelectorAll('.post-actions button[title="Share"]').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('Share clicked');
    });
  });
}

function bindDropdownToggles() {
  document.querySelectorAll('.post-dropdown-toggle').forEach(toggle => {
    // Prevent duplicate listeners by checking if it's already bound
    if (!toggle.dataset.bound) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = toggle.nextElementSibling;
        menu.classList.toggle('show');
      });
      toggle.dataset.bound = "true";
    }
  });

  // Add one global listener to close dropdowns
  if (!document.body.dataset.dropdownListenerBound) {
    document.addEventListener('click', () => {
      document.querySelectorAll('.post-dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
      });
    });
    document.body.dataset.dropdownListenerBound = "true";
  }
}
