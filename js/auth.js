import { requireSupabaseClient } from "./supabase.js";
import {
  ensureUserProfile,
  getSetupMessage,
  isUsernameAvailable,
  redirectAuthenticatedUser,
  validateUsername
} from "./session.js";

// The same script is loaded by both `/` and `/register`, so each reference is optional.
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const globalMessage = document.getElementById("auth-global-message");

// This writes status text into either the page-level message area or a form-specific feedback row.
function setMessage(element, message, type = "") {
  if (!element) {
    return;
  }

  element.textContent = message || "";
  element.classList.remove("is-error", "is-success");
  if (type) {
    element.classList.add(type);
  }
}

// Button loading state is shared so login/signup both get disabled while their requests are in flight.
function setButtonLoading(button, isLoading) {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
}

// Inputs get a red invalid state when client-side validation fails before any API request is sent.
function markFieldValidity(input, isValid) {
  if (!input) {
    return;
  }

  input.classList.toggle("is-invalid", !isValid);
}

// Static frontend validation catches obvious issues before hitting Supabase.
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function validatePassword(password) {
  return String(password || "").length >= 8;
}

// Supabase error objects vary slightly, so this mapper keeps feedback readable for users.
function mapAuthError(error, mode) {
  const message = (error?.message || "").toLowerCase();
  const status = error?.status;

  if (message.includes("invalid login credentials")) {
    return "Wrong email or password.";
  }

  if (message.includes("email not confirmed")) {
    return "Check your inbox and confirm your email before logging in.";
  }

  if (message.includes("user already registered")) {
    return "That email is already registered.";
  }

  if (message.includes("duplicate key") && message.includes("username")) {
    return "That username is already taken.";
  }

  if (message.includes("failed to fetch") || status === 0) {
    return "Network error. Check your connection and try again.";
  }

  if (mode === "signup" && message.includes("password")) {
    return "Password must be at least 8 characters long.";
  }

  return error?.message || "Something went wrong. Try again.";
}

// Signup performs a best-effort username availability check before creating the auth user.
async function handleSignupSubmit(event) {
  event.preventDefault();

  const client = requireSupabaseClient();
  const formMessage = document.getElementById("signup-message");
  const button = document.getElementById("signup-button");
  const usernameInput = document.getElementById("signup-username");
  const emailInput = document.getElementById("signup-email");
  const passwordInput = document.getElementById("signup-password");

  // Form values are normalized once here so later checks and API calls use the same data.
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setMessage(formMessage, "");
  setMessage(globalMessage, "");
  markFieldValidity(usernameInput, validateUsername(username));
  markFieldValidity(emailInput, validateEmail(email));
  markFieldValidity(passwordInput, validatePassword(password));

  if (!validateUsername(username)) {
    setMessage(formMessage, "Username must be 3-24 characters and use only letters, numbers, or underscores.", "is-error");
    return;
  }

  if (!validateEmail(email)) {
    setMessage(formMessage, "Enter a valid email address.", "is-error");
    return;
  }

  // This CTF is restricted to @gmail.com accounts only to prevent disposable/temp email registrations.
  if (!email.toLowerCase().endsWith("@gmail.com")) {
    markFieldValidity(emailInput, false);
    setMessage(formMessage, "Only @gmail.com accounts are allowed to register.", "is-error");
    return;
  }

  if (!validatePassword(password)) {
    setMessage(formMessage, "Password must be at least 8 characters long.", "is-error");
    return;
  }

  setButtonLoading(button, true);

  try {
    // Checking username early gives faster feedback than waiting for the insert to fail later.
    const usernameAvailable = await isUsernameAvailable(username);
    if (!usernameAvailable) {
      markFieldValidity(usernameInput, false);
      setMessage(formMessage, "That username is already taken.", "is-error");
      return;
    }

    // The username is stored in auth metadata too, so recovery code can rebuild a missing profile row.
    const { data, error } = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: username
        }
      }
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("Signup completed without a user record.");
    }

    // When email confirmation is disabled, Supabase returns a session immediately and we can continue.
    if (data.session) {
      await ensureUserProfile(data.user, username);
      setMessage(formMessage, "Account created. Redirecting to dashboard...", "is-success");
      window.setTimeout(function () {
        window.location.replace("/dashboard/");
      }, 700);
      return;
    }

    // When confirmation is required, the browser cannot finish signup fully until the user verifies email.
    setMessage(
      formMessage,
      "Account created. Confirm your email, then log in. Your profile will be created on first authenticated session.",
      "is-success"
    );
    signupForm.reset();
    window.setTimeout(function () {
      window.location.replace("/index.html");
    }, 900);
  } catch (error) {
    setMessage(formMessage, mapAuthError(error, "signup"), "is-error");
  } finally {
    setButtonLoading(button, false);
  }
}

// Login signs the user in and lets the protected dashboard bootstrap the rest of the session state.
async function handleLoginSubmit(event) {
  event.preventDefault();

  const client = requireSupabaseClient();
  const formMessage = document.getElementById("login-message");
  const button = document.getElementById("login-button");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");

  // Login only needs email/password because the profile row already exists or is auto-recovered later.
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setMessage(formMessage, "");
  setMessage(globalMessage, "");
  markFieldValidity(emailInput, validateEmail(email));
  markFieldValidity(passwordInput, validatePassword(password));

  if (!validateEmail(email)) {
    setMessage(formMessage, "Enter a valid email address.", "is-error");
    return;
  }

  if (!password) {
    markFieldValidity(passwordInput, false);
    setMessage(formMessage, "Enter your password.", "is-error");
    return;
  }

  setButtonLoading(button, true);

  try {
    // Password login creates the persisted browser session used by all protected pages.
    const { error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      throw error;
    }

    setMessage(formMessage, "Login successful. Redirecting...", "is-success");
    window.setTimeout(function () {
      window.location.replace("/dashboard/");
    }, 500);
  } catch (error) {
    setMessage(formMessage, mapAuthError(error, "login"), "is-error");
  } finally {
    setButtonLoading(button, false);
  }
}

// Startup keeps the auth entry pages minimal: validate setup, bounce signed-in users, then attach handlers.
async function initAuthPage() {
  const setupMessage = getSetupMessage();
  if (setupMessage) {
    setMessage(globalMessage, setupMessage, "is-error");
    return;
  }

  try {
    await redirectAuthenticatedUser();
  } catch (error) {
    setMessage(globalMessage, mapAuthError(error, "login"), "is-error");
    return;
  }

  loginForm?.addEventListener("submit", handleLoginSubmit);
  signupForm?.addEventListener("submit", handleSignupSubmit);
}

initAuthPage();
