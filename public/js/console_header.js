
  const profile = document.getElementById('profileDropdown');

  profile.addEventListener('click', () => {
    profile.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!profile.contains(e.target)) {
      profile.classList.remove('active');
    }
  });



  
