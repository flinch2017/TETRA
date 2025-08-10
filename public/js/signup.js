function bindSignupForm() {
  const form = document.getElementById('signupForm');
  const errorMessage = document.getElementById('errorMessage');
  const recaptchaContainer = document.getElementById('recaptcha-container');

  if (!form || !errorMessage || !recaptchaContainer) return;

  // Render the reCAPTCHA if available
  if (typeof grecaptcha !== 'undefined' && !recaptchaContainer.hasChildNodes()) {
    grecaptcha.render(recaptchaContainer, {
      sitekey: '6LeS058rAAAAAPtasBchk895HK0PspPMlUAcC1zq'
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorMessage.style.display = 'none';

    const password = form.password.value.trim();
    const confirmPassword = form.confirmPassword.value.trim();

    if (password !== confirmPassword) {
      errorMessage.textContent = 'Passwords do not match!';
      errorMessage.style.display = 'block';
      return;
    }

    if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse().length === 0) {
      errorMessage.textContent = 'Please complete the CAPTCHA.';
      errorMessage.style.display = 'block';
      return;
    }

    // Prepare form data
    const formData = new FormData(form);

    try {
      const res = await fetch('/signup', {
        method: 'POST',
        body: formData
      });

      // Backend should return JSON for AJAX calls
      const data = await res.json();

      if (!res.ok || data.error) {
        errorMessage.textContent = data.error || 'Signup failed. Please try again.';
        errorMessage.style.display = 'block';
      } else if (data.redirect) {
        window.location.href = data.redirect;
      }

    } catch (err) {
      console.error('AJAX signup error:', err);
      errorMessage.textContent = 'Network error. Please try again.';
      errorMessage.style.display = 'block';
    }
  });
}

document.addEventListener('DOMContentLoaded', bindSignupForm);
