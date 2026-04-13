import { getSupabaseConfigError, requireSupabaseClient } from "/js/supabase.js";

const passwordInput = document.getElementById("rp-password");
const confirmInput = document.getElementById("rp-confirm");
const passwordError = document.getElementById("rp-password-error");
const confirmError = document.getElementById("rp-confirm-error");
const globalError = document.getElementById("rp-global-error");
const submitButton = document.getElementById("rp-submit");
const form = document.getElementById("rp-form");
const strengthFill = document.getElementById("rp-strength-fill");
const strengthLabel = document.getElementById("rp-strength-label");

const RECOVERY_HASH_PATTERN = /(?:^|[&#])type=recovery(?:&|$)/i;
const RECOVERY_QUERY_PATTERN = /(?:^|[?&])type=recovery(?:&|$)/i;
const RECOVERY_TOKEN_PATTERN = /(?:^|[&#])(access_token|code)=/i;
const RECOVERY_ERROR_PATTERN = /(?:^|[?#&])(error|error_code|error_description)=/i;
const EXPIRED_LINK_MESSAGE = "This reset link has expired or was already used. Request a new email link and try again.";

const supabase = (() => {
  try {
    return requireSupabaseClient();
  } catch (error) {
    console.error("[MKK Reset] Failed to initialize Supabase client:", error);
    return null;
  }
})();

let recoverySessionActive = false;
let submissionInFlight = false;
let recoverySessionVerified = false;
let resolveRecoveryVerification;
const recoveryVerificationPromise = new Promise(function (resolve) {
  resolveRecoveryVerification = resolve;
});

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

  setFieldState(passwordInput, passwordError, "", passwordInput.value ? "is-success" : "");
  return true;
}

function validateConfirmField() {
  if (!confirmInput.value) {
    setFieldState(confirmInput, confirmError, "confirm your new password", "is-error");
    return false;
  }

  if (confirmInput.value !== passwordInput.value) {
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

function setGlobalMessage(message, type) {
  globalError.textContent = message || "";
  globalError.classList.remove("is-visible", "is-error", "is-success");

  if (message) {
    globalError.classList.add("is-visible");
  }

  if (type) {
    globalError.classList.add(type);
  }
}

function setFormEnabled(enabled) {
  passwordInput.disabled = !enabled;
  confirmInput.disabled = !enabled;
}

function enableForm() {
  recoverySessionActive = true;
  recoverySessionVerified = true;
  setFormEnabled(true);
  setGlobalMessage("", "");
  setButtonState("idle");
  resolveRecoveryVerification(true);
}

function expireRecoveryLink(message) {
  recoverySessionActive = false;
  setFormEnabled(false);
  setButtonState("idle");
  setGlobalMessage(message || EXPIRED_LINK_MESSAGE, "is-error");
}

function getCombinedRecoveryParams() {
  const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search || "");
  return {
    type: hashParams.get("type") || searchParams.get("type") || "",
    code: hashParams.get("code") || searchParams.get("code") || "",
    accessToken: hashParams.get("access_token") || searchParams.get("access_token") || "",
    refreshToken: hashParams.get("refresh_token") || searchParams.get("refresh_token") || "",
    error: hashParams.get("error") || searchParams.get("error") || "",
    errorCode: hashParams.get("error_code") || searchParams.get("error_code") || "",
    errorDescription: hashParams.get("error_description") || searchParams.get("error_description") || ""
  };
}

function hasRecoveryErrorHints() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return RECOVERY_ERROR_PATTERN.test(hash) || RECOVERY_ERROR_PATTERN.test(search);
}

function sessionMatchesRecoveryLink(session) {
  const params = getCombinedRecoveryParams();

  // Recovery links can arrive with access/refresh tokens in the hash; only trust them if they match this page load.
  if (params.accessToken) {
    return session.access_token === params.accessToken;
  }

  if (params.refreshToken) {
    return session.refresh_token === params.refreshToken;
  }

  // If the URL only carries a recovery code, wait for the dedicated PASSWORD_RECOVERY event instead of trusting
  // whichever session happened to already be stored in localStorage.
  return false;
}

async function waitForRecoveryVerification(timeoutMs) {
  if (recoverySessionVerified) {
    return true;
  }

  return Promise.race([
    recoveryVerificationPromise,
    new Promise(function (resolve) {
      window.setTimeout(function () {
        resolve(false);
      }, timeoutMs);
    })
  ]);
}

function hasRecoveryLinkHints() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const combined = hash + search;

  return (
    RECOVERY_HASH_PATTERN.test(hash) ||
    RECOVERY_QUERY_PATTERN.test(search) ||
    RECOVERY_TOKEN_PATTERN.test(combined)
  );
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
    submitButton.textContent = "> PASSWORD UPDATED";
    submitButton.disabled = true;
    return;
  }

  if (state === "error") {
    submitButton.classList.add("is-error");
    submitButton.textContent = "> UPDATE FAILED";
    submitButton.disabled = !recoverySessionActive || submissionInFlight;
    return;
  }

  submitButton.textContent = "> UPDATE PASSWORD";
  submitButton.disabled = !recoverySessionActive || submissionInFlight;
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
      button.setAttribute(
        "aria-label",
        targetInput.type === "password" ? "Show password" : "Hide password"
      );
    });
  });
}

async function bootstrapRecoveryState() {
  if (!supabase) {
    setGlobalMessage(
      getSupabaseConfigError() || "Password recovery is temporarily unavailable because the auth client could not start.",
      "is-error"
    );
    setFormEnabled(false);
    submitButton.disabled = true;
    return;
  }

  if (hasRecoveryLinkHints()) {
    setGlobalMessage("Verifying recovery link...", "");
  } else {
    setGlobalMessage("Open this page from the password reset link sent to your email.", "is-error");
  }

  supabase.auth.onAuthStateChange(function (event, session) {
    // Supabase emits PASSWORD_RECOVERY once the email link has been exchanged for a usable session.
    if (event === "PASSWORD_RECOVERY" && session) {
      enableForm();
    }
  });

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (data.session && sessionMatchesRecoveryLink(data.session)) {
      enableForm();
      return;
    }

    if (hasRecoveryLinkHints() && await waitForRecoveryVerification(1500)) {
      return;
    }

    if (hasRecoveryLinkHints()) {
      expireRecoveryLink(EXPIRED_LINK_MESSAGE);
      return;
    }

    if (hasRecoveryErrorHints()) {
      expireRecoveryLink(EXPIRED_LINK_MESSAGE);
      return;
    }

    setGlobalMessage("Open this page from the password reset link sent to your email.", "is-error");
  } catch (error) {
    console.error("[MKK Reset] Failed to read recovery session:", error);
    if (hasRecoveryLinkHints() || hasRecoveryErrorHints()) {
      expireRecoveryLink(EXPIRED_LINK_MESSAGE);
      return;
    }

    setGlobalMessage(error?.message || "Unable to validate the recovery link right now.", "is-error");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  bindEyeToggles();
  updateStrengthIndicator();

  passwordInput.addEventListener("input", function () {
    updateStrengthIndicator();

    if (passwordError.textContent || passwordInput.classList.contains("is-success")) {
      validatePasswordField();
    }

    if (confirmInput.value) {
      validateConfirmField();
    }
  });

  confirmInput.addEventListener("input", function () {
    if (confirmError.textContent || confirmInput.classList.contains("is-success")) {
      validateConfirmField();
    }
  });

  passwordInput.addEventListener("blur", validatePasswordField);
  confirmInput.addEventListener("blur", validateConfirmField);

  bootstrapRecoveryState();
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  setGlobalMessage("", "");

  if (!supabase) {
    setGlobalMessage(getSupabaseConfigError() || "Password recovery is temporarily unavailable.", "is-error");
    return;
  }

  if (!recoverySessionActive) {
    setGlobalMessage(EXPIRED_LINK_MESSAGE, "is-error");
    return;
  }

  if (!validateForm()) {
    return;
  }

  submissionInFlight = true;
  setButtonState("loading");

  try {
    const { error } = await supabase.auth.updateUser({
      password: passwordInput.value
    });

    if (error) {
      throw error;
    }

    setButtonState("success");
    setGlobalMessage("Password updated. Redirecting you to log in with the new credentials...", "is-success");

    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.warn("[MKK Reset] Password updated but sign-out failed:", signOutError);
    }

    window.setTimeout(function () {
      window.location.replace("/index.html");
    }, 1600);
  } catch (error) {
    console.error("[MKK Reset] updateUser failed:", error);
    setButtonState("error");
    if (/expired|invalid|otp|token|session/i.test(String(error?.message || ""))) {
      expireRecoveryLink(EXPIRED_LINK_MESSAGE);
      return;
    }

    setGlobalMessage(error?.message || "Unable to update password right now.", "is-error");
  } finally {
    submissionInFlight = false;
    if (!submitButton.classList.contains("is-success")) {
      setButtonState("idle");
    }
  }
});
