document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
      // If redirected to verification or dashboard or pricing
      if (data.redirect) {
        
        window.location.href = data.redirect;
      }
    } else {
      showError(data.error || 'Login failed.');
    }
  } catch (err) {
    console.error(err);
    showError('Something went wrong. Try again later.');
  }
});

function showError(message) {
  let errorDiv = document.querySelector('.error-message');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    document.querySelector('.login-container').prepend(errorDiv);
  }
  errorDiv.textContent = message;
}