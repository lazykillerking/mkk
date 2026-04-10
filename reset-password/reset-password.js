const SUPABASE_URL = "https://jhyymmvbovpbuaobegcu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoeXltbXZib3ZwYnVhb2JlZ2N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Nzc3MDksImV4cCI6MjA5MTA1MzcwOX0.FV90_X3a1DAnLel998Dl93N_UhR7n81w8nTPyMbX-Xw";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "mkk-auth"
  }
});

const passwordInput = document.getElementById("rp-password");
const confirmInput = document.getElementById("rp-confirm");
const passwordError = document.getElementById("rp-password-error");
const confirmError = document.getElementById("rp-confirm-error");
const globalError = document.getElementById("rp-global-error");
const submitButton = document.getElementById("rp-submit");
const form = document.getElementById("rp-form");
const strengthFill = document.getElementById("rp-strength-fill");
const strengthLabel = document.getElementById("rp-strength-label");

// The form only becomes usable after Supabase confirms a valid recovery session.
let recoverySessionActive = false;

function scorePassword(password) {
  let score = 0;

  if (password.length >= 8) {
    score += 25;
  }
  if (password.length >= 12) {
    score += 25;
  }
  if (/\d/.test(password)) {
    score += 20;
  }
  if (/[!@#$%^&*(),.?":{}|<>_\-\\[\]/`~+=;]/.test(password)) {
    score += 20;
  }
  if (/[A-Z]/.test(password)) {
    score += 10;
  }

  return score;
}

function getStrengthMeta(score) {
  if (score >= 67) {
    return {
      label: "strong",
      color: "var(--green)",
      width: "100%"
    };
  }

  if (score >= 34) {
    return {
      label: "medium",
      color: "var(--amber)",
      width: "66%"
    };
  }

  return {
    label: "weak",
    color: "var(--red)",
    width: score > 0 ? "33%" : "0%"
  };
}

function updateStrengthIndicator() {
  // The visual meter deliberately uses only three states to keep feedback easy to scan.
  const meta = getStrengthMeta(scorePassword(passwordInput.value));
  strengthFill.style.width = meta.width;
  strengthFill.style.backgroundColor = meta.color;
  strengthLabel.textContent = meta.label;
  strengthLabel.style.color = meta.color;
}

function setFieldState(input, errorElement, message, state) {
  input.classList.remove("is-error", "is-success");
  errorElement.textContent = message || "";

  if (state) {
    input.classList.add(state);
  }
}

function validatePasswordField() {
  if (passwordInput.value.length < 8) {
    setFieldState(passwordInput, passwordError, "minimum 8 characters required", "is-error");
    return false;
  }

  setFieldState(passwordInput, passwordError, "", "");
  return true;
}

function validateConfirmField() {
  if (confirmInput.value !== passwordInput.value) {
    setFieldState(confirmInput, confirmError, "passwords do not match", "is-error");
    return false;
  }

  if (!confirmInput.value) {
    setFieldState(confirmInput, confirmError, "passwords do not match", "is-error");
    return false;
  }

  setFieldState(confirmInput, confirmError, "", "is-success");
  return true;
}

function validateForm() {
  const passwordValid = validatePasswordField();
  const confirmValid = validateConfirmField();
  return passwordValid && confirmValid;
}

function setGlobalError(message) {
  globalError.textContent = message || "";
  globalError.classList.toggle("is-visible", Boolean(message));
}

function enableForm() {
  recoverySessionActive = true;
  passwordInput.disabled = false;
  confirmInput.disabled = false;
  submitButton.disabled = false;
}

function setButtonState(state) {
  submitButton.classList.remove("is-loading", "is-success", "is-error");

  if (state === "loading") {
    submitButton.classList.add("is-loading");
    submitButton.textContent = "updating...";
    submitButton.disabled = true;
    return;
  }

  if (state === "success") {
    submitButton.classList.add("is-success");
    submitButton.textContent = "> password updated ✓";
    submitButton.disabled = true;
    return;
  }

  if (state === "error") {
    submitButton.classList.add("is-error");
    submitButton.textContent = "> update failed - try again";
    submitButton.disabled = false;
    return;
  }

  submitButton.textContent = "> UPDATE PASSWORD";
  submitButton.disabled = !recoverySessionActive;
}

function bindEyeToggles() {
  document.querySelectorAll(".rp-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      const targetId = button.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (!targetInput) {
        return;
      }

      targetInput.type = targetInput.type === "password" ? "text" : "password";
    });
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  bindEyeToggles();
  updateStrengthIndicator();

  passwordInput.addEventListener("input", updateStrengthIndicator);
  passwordInput.addEventListener("blur", validatePasswordField);
  confirmInput.addEventListener("blur", validateConfirmField);

  supabase.auth.onAuthStateChange(function (event, session) {
    // PASSWORD_RECOVERY is emitted when Supabase finishes parsing the reset token from the URL.
    if (event === "PASSWORD_RECOVERY" && session) {
      setGlobalError("");
      enableForm();
      setButtonState("idle");
    }
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    // getSession() covers page refreshes after the recovery link has already been consumed once.
    enableForm();
    setButtonState("idle");
  }

  window.setTimeout(function () {
    if (!recoverySessionActive) {
      setGlobalError("invalid or expired reset link");
      submitButton.disabled = true;
    }
  }, 3000);
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  setGlobalError("");

  if (!validateForm()) {
    return;
  }

  setButtonState("loading");

  try {
    // updateUser() uses the recovery session established from the email link.
    const { error } = await supabase.auth.updateUser({
      password: passwordInput.value
    });

    if (error) {
      throw error;
    }

    setButtonState("success");
    window.setTimeout(function () {
      window.location.replace("/dashboard/");
    }, 1800);
  } catch (error) {
    setButtonState("error");
    setGlobalError(error?.message || "Unable to update password right now.");
  }
});
