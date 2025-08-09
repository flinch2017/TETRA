function loadRecaptchaScript(callback) {
  // Remove old script if any
  const oldScript = document.getElementById('recaptcha-script');
  if (oldScript) {
    oldScript.remove();
    // Also clear old widget container to avoid duplicates
    const container = document.querySelector('.g-recaptcha');
    if (container) container.innerHTML = '';
  }

  const script = document.createElement('script');
  script.id = 'recaptcha-script';
  script.src = 'https://www.google.com/recaptcha/api.js';
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.body.appendChild(script);
}

function bindSignupForm() {
  const form = document.getElementById('signupForm');
  const errorMessage = document.getElementById('errorMessage');
  if (!form || !errorMessage) return;

  form.removeEventListener('submit', signupFormSubmitHandler);

  function signupFormSubmitHandler(e) {
    errorMessage.style.display = 'none';
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
      e.preventDefault();
      errorMessage.textContent = 'Passwords do not match!';
      errorMessage.style.display = 'block';
      return;
    }

    if (typeof grecaptcha === 'undefined' || grecaptcha.getResponse().length === 0) {
      e.preventDefault();
      errorMessage.textContent = 'Please complete the CAPTCHA.';
      errorMessage.style.display = 'block';
      return;
    }
  }

  form.addEventListener('submit', signupFormSubmitHandler);

  // Load recaptcha script and run
  loadRecaptchaScript(() => {
    // Optional callback after recaptcha script loads
    // The reCAPTCHA widget auto-renders on elements with class 'g-recaptcha' when the script loads
  });
}
