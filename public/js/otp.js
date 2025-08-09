document.addEventListener("DOMContentLoaded", () => {
  const COOLDOWN_SECONDS = 30; // change if you want longer wait
  const otpForm = document.getElementById("otpForm");
  const resendOtp = document.getElementById("resendOtp");
  let errorMessage = document.getElementById("errorMessage");
  let countdownTimer = null;

  // if errorMessage not present (safety), create it
  if (!errorMessage && otpForm) {
    errorMessage = document.createElement("div");
    errorMessage.id = "errorMessage";
    errorMessage.className = "error-message";
    errorMessage.style.display = "none";
    otpForm.parentNode.insertBefore(errorMessage, otpForm.nextSibling);
  }

  const rawDataEmail = otpForm?.dataset.email || "";
  const email = rawDataEmail ? decodeURIComponent(rawDataEmail) : null;
  const storageKey = (e) => `otpResendExpiry_${encodeURIComponent(e || "unknown")}`;

  const showMessage = (msg, isError = false) => {
    if (!errorMessage) return;
    errorMessage.textContent = msg;
    errorMessage.style.display = "block";
    errorMessage.style.color = isError ? "red" : "lightgreen";
    errorMessage.style.opacity = 0;
    requestAnimationFrame(() => {
      errorMessage.style.opacity = 1;
    });
  };

  const getRemaining = () => {
    if (!email) return 0;
    const v = localStorage.getItem(storageKey(email));
    if (!v) return 0;
    const expiry = parseInt(v, 10);
    if (Number.isNaN(expiry)) return 0;
    return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  };

  const setExpiry = (secondsFromNow) => {
    if (!email) return;
    const expiry = Date.now() + secondsFromNow * 1000;
    localStorage.setItem(storageKey(email), String(expiry));
  };

  const enableResendUI = () => {
    if (!resendOtp) return;
    resendOtp.classList.remove("disabled");
    resendOtp.style.pointerEvents = "auto";
    resendOtp.innerHTML = `Didn't receive the code? Resend`;
  };

  const disableResendUI = (textHtml) => {
    if (!resendOtp) return;
    resendOtp.classList.add("disabled");
    resendOtp.style.pointerEvents = "none";
    resendOtp.innerHTML = textHtml;
  };

  const startCountdown = (seconds) => {
    if (!resendOtp) return;
    clearInterval(countdownTimer);
    let remaining = seconds;

    // initial UI
    disableResendUI(`Waiting for code — ${remaining}s <span class="spinner-mini"></span>`);

    countdownTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        disableResendUI(`Waiting for code — ${remaining}s <span class="spinner-mini"></span>`);
      } else {
        clearInterval(countdownTimer);
        enableResendUI();
      }
    }, 1000);
  };

  // Initialize: if there's an existing expiry in localStorage use it,
  // otherwise assume the user just got an OTP and start cooldown.
  if (email && resendOtp) {
    let remaining = getRemaining();
    if (remaining <= 0) {
      // Start fresh countdown for the user who is waiting for the initial OTP
      setExpiry(COOLDOWN_SECONDS);
      remaining = COOLDOWN_SECONDS;
    }
    startCountdown(remaining);
  }

  // Form submit (verify OTP)
  otpForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const otp = otpForm.otp.value.trim();
    if (!/^\d{6}$/.test(otp)) {
      return showMessage("Please enter a valid 6-digit OTP", true);
    }

    try {
      const res = await fetch(`/verify-otp?email=${encodeURIComponent(email)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp })
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirect;
      } else {
        showMessage(data.error || "Unexpected error", true);
      }
    } catch (err) {
      showMessage("Network error, please try again", true);
    }
  });

  // Resend click
  resendOtp?.addEventListener("click", async () => {
    if (!email) {
      showMessage("Missing email address", true);
      return;
    }

    // If cooldown still has time, don't send
    if (getRemaining() > 0) return;

    // Show sending state
    disableResendUI(`Sending\u2026 <span class="spinner-mini"></span>`);

    try {
      const res = await fetch(`/resend-otp?email=${encodeURIComponent(email)}`, {
        method: "POST"
      });
      const data = await res.json();

      if (data.success) {
        showMessage("OTP resent to your email", false);
        // restart cooldown and persist it
        setExpiry(COOLDOWN_SECONDS);
        startCountdown(COOLDOWN_SECONDS);
      } else {
        // show error and re-enable
        showMessage(data.error || "Could not resend OTP", true);
        enableResendUI();
      }
    } catch (err) {
      showMessage("Network error, please try again", true);
      enableResendUI();
    }
  });
});
