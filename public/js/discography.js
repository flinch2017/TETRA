function bindReleaseTypeFilter() {
  const buttons = document.querySelectorAll('.release-type-btn');

  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Toggle active class
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Get updated items after sorting
      const items = document.querySelectorAll('.release-item');

      // Filter release items
      items.forEach(item => {
        item.style.display = (filter === 'all' || item.dataset.type === filter) ? 'flex' : 'none';
      });
    });
  });
}


