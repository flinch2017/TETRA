const form = document.getElementById('signupForm');
    const errorMessage = document.getElementById('errorMessage');

    form.addEventListener('submit', (e) => {
  errorMessage.style.display = 'none';
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (password !== confirmPassword) {
    e.preventDefault();
    errorMessage.textContent = 'Passwords do not match!';
    errorMessage.style.display = 'block';
    return;
  }

  if (grecaptcha.getResponse().length === 0) {
    e.preventDefault();
    errorMessage.textContent = 'Please complete the CAPTCHA.';
    errorMessage.style.display = 'block';
  }
});