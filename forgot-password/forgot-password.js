import { getSupabaseConfigError, requireSupabaseClient } from "/js/supabase.js";

const RESET_REDIRECT_URL = "https://mkk.lazykillerking.xyz/reset-password/";

const forgotForm = document.getElementById("forgot-form");
const emailInput = document.getElementById("forgot-email");
const messageElement = document.getElementById("forgot-message");
const submitButton = document.getElementById("forgot-submit");

const supabase = (() => {
  try {
    return requireSupabaseClient();
  } catch (error) {
    console.error("[MKK Recovery] Failed to initialize Supabase client:", error);
    return null;
  }
})();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function setMessage(message, type) {
  messageElement.textContent = message;
  messageElement.classList.remove("is-error", "is-success");
  emailInput.classList.remove("is-error", "is-success");

  if (type) {
    messageElement.classList.add(type);
    emailInput.classList.add(type);
  }
}

forgotForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = emailInput.value.trim();
  setMessage("", "");

  if (!supabase) {
    setMessage(getSupabaseConfigError() || "Recovery is temporarily unavailable because the auth client could not start.", "is-error");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage("Enter a valid email address before requesting recovery.", "is-error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "transmitting...";

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_REDIRECT_URL
    });

    if (error) {
      throw error;
    }

    setMessage("Recovery link transmitted. Check your inbox for the reset portal.", "is-success");
    submitButton.textContent = "> LINK SENT";
    submitButton.classList.add("is-success");
  } catch (error) {
    console.error("[MKK Recovery] resetPasswordForEmail failed:", error);
    submitButton.disabled = false;
    submitButton.textContent = "> SEND RESET LINK";
    submitButton.classList.remove("is-success");
    setMessage(error?.message || "Unable to send the recovery link right now. Try again.", "is-error");
  }
});
