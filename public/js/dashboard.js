document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.post-dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = toggle.nextElementSibling;
      menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.post-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });
});