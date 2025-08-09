function renderRecaptcha() {
  if (typeof grecaptcha !== 'undefined') {
    const container = document.querySelector('.g-recaptcha');
    if (container) {
      // Clear previous widget if any
      container.innerHTML = '';

      // Render the widget again
      grecaptcha.render(container, {
        sitekey: '6LeS058rAAAAAPtasBchk895HK0PspPMlUAcC1zq',
      });
    }
  }
}

function renderRecaptchaWhenReady() {
  if (typeof grecaptcha !== 'undefined') {
    renderRecaptcha();
  } else {
    // Retry after 100ms if grecaptcha not yet loaded
    setTimeout(renderRecaptchaWhenReady, 100);
  }
}

function bindSignupForm() {
  const form = document.getElementById('signupForm');
  const errorMessage = document.getElementById('errorMessage');

  if (!form || !errorMessage) return; // no signup form on this page

  // Remove any existing listeners to avoid duplicates
  form.removeEventListener('submit', signupFormSubmitHandler);

  // Define submit handler separately so we can remove it
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

  // Render reCAPTCHA widget after signup form is bound
  renderRecaptchaWhenReady();
}
