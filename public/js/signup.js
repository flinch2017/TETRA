function bindSignupForm() {
  const form = document.getElementById('signupForm');
  const errorMessage = document.getElementById('errorMessage');

  if (!form || !errorMessage) return;

  form.addEventListener('submit', function (e) {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';

    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
      e.preventDefault();
      errorMessage.textContent = 'Passwords do not match!';
      errorMessage.style.display = 'block';
      return;
    }

    // Check if CAPTCHA is completed
    if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse().length === 0) {
      e.preventDefault();
      errorMessage.textContent = 'Please complete the CAPTCHA.';
      errorMessage.style.display = 'block';
      return;
    }
  });
}

document.addEventListener('DOMContentLoaded', bindSignupForm);
