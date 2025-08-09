function bindSignupForm() {
  const form = document.getElementById('signupForm');
  const errorMessage = document.getElementById('errorMessage');
  const recaptchaContainer = document.getElementById('recaptcha-container');

  if (!form || !errorMessage || !recaptchaContainer) return;

  // Render the reCAPTCHA widget if not already rendered
  if (typeof grecaptcha !== 'undefined' && !recaptchaContainer.hasChildNodes()) {
    grecaptcha.render(recaptchaContainer, {
      sitekey: '6LeS058rAAAAAPtasBchk895HK0PspPMlUAcC1zq'
    });
  }

  // Remove any existing listeners to avoid duplicates
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

    if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse().length === 0) {
      e.preventDefault();
      errorMessage.textContent = 'Please complete the CAPTCHA.';
      errorMessage.style.display = 'block';
    }
  }

  form.addEventListener('submit', signupFormSubmitHandler);
}
