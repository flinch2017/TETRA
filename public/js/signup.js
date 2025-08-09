function renderRecaptchaWidget() {
  const container = document.querySelector('.g-recaptcha');
  if (!container) return;

  // If we already rendered a widget here, reset container first
  container.innerHTML = '';

  // Render the widget explicitly and save widgetId
  window.recaptchaWidgets.signup = grecaptcha.render(container, {
    sitekey: '6LeS058rAAAAAPtasBchk895HK0PspPMlUAcC1zq',
  });
}

function bindSignupForm() {
  const form = document.getElementById('signupForm');
  const errorMessage = document.getElementById('errorMessage');

  if (!form || !errorMessage) return; // no signup form on this page

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

    if (!grecaptcha || grecaptcha.getResponse(window.recaptchaWidgets.signup).length === 0) {
      e.preventDefault();
      errorMessage.textContent = 'Please complete the CAPTCHA.';
      errorMessage.style.display = 'block';
    }
  }

  form.addEventListener('submit', signupFormSubmitHandler);

  if (typeof grecaptcha !== 'undefined') {
    renderRecaptchaWidget();
  } else {
    // Wait for recaptcha to load
    document.addEventListener('recaptchaLoaded', renderRecaptchaWidget, { once: true });
  }
}
