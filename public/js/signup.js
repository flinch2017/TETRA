function renderRecaptcha() {
  const container = document.getElementById('recaptcha-container');
  if (!container) return;

  if (typeof grecaptcha !== 'undefined') {
    container.innerHTML = ''; // clear previous widget if any
    grecaptcha.render('recaptcha-container', {
      sitekey: '6LeS058rAAAAAPtasBchk895HK0PspPMlUAcC1zq'
    });
  }
}




function bindSignupForm() {
  const form = document.getElementById('signupForm');
  const errorMessage = document.getElementById('errorMessage');

  if (!form || !errorMessage) return;

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

  form.removeEventListener('submit', signupFormSubmitHandler);
  form.addEventListener('submit', signupFormSubmitHandler);

  renderRecaptcha();
}

