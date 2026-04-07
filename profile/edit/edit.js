/**
 * Edit Profile Controller
 * 
 * Manages the state, validation, and submission of the Edit Profile page.
 * Uses optimistic state cues (disabling buttons, immediate validation feedback)
 * and relays data back to Supabase through the centralized `updateUserProfile` session API.
 */
import {
  requireAuth,
  populateAuthUI,
  bindLogoutButtons,
  updateUserProfile,
  validateUsername,
  isUsernameAvailable
} from "../../js/session.js";

const form = document.getElementById("edit-profile-form");
const usernameInput = document.getElementById("edit-username");
const firstNameInput = document.getElementById("edit-first-name");
const lastNameInput = document.getElementById("edit-last-name");
const countrySelect = document.getElementById("edit-country");
const aboutInput = document.getElementById("edit-about");
const counter = document.getElementById("about-counter");
const usernameFeedback = document.getElementById("username-feedback");
const globalMessage = document.getElementById("edit-global-message");
const submitButton = document.getElementById("edit-submit-button");

let initialData = {};

function setMessage(msg, isError) {
  globalMessage.textContent = msg;
  globalMessage.style.color = isError ? "var(--amber-core)" : "var(--cyan-core)";
}

function checkFormDirty() {
  const isDirty = 
    usernameInput.value.trim() !== (initialData.username || "") ||
    firstNameInput.value.trim() !== (initialData.first_name || "") ||
    lastNameInput.value.trim() !== (initialData.last_name || "") ||
    countrySelect.value !== (initialData.country || "") ||
    aboutInput.value.trim() !== (initialData.about || "");

  const usernameValid = validateUsername(usernameInput.value.trim());

  submitButton.disabled = !isDirty || !usernameValid;
  submitButton.style.opacity = submitButton.disabled ? "0.5" : "1";
}

function initLiveValidation() {
  usernameInput.addEventListener("input", () => {
    const val = usernameInput.value.trim();
    if (!validateUsername(val)) {
      usernameFeedback.textContent = "3-24 characters, letters/numbers/underscores only";
    } else {
      usernameFeedback.textContent = "";
    }
    checkFormDirty();
  });

  aboutInput.addEventListener("input", () => {
    counter.textContent = `${aboutInput.value.length}/300`;
    checkFormDirty();
  });

  firstNameInput.addEventListener("input", checkFormDirty);
  lastNameInput.addEventListener("input", checkFormDirty);
  countrySelect.addEventListener("change", checkFormDirty);
}

async function handleFormSubmit(event) {
  event.preventDefault();
  
  const newUsername = usernameInput.value.trim();
  
  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  submitButton.style.opacity = "0.5";
  setMessage("", false);
  usernameFeedback.textContent = "";

  try {
    // Check username availability if changed
    if (newUsername !== (initialData.username || "")) {
      const available = await isUsernameAvailable(newUsername);
      if (!available) {
        usernameFeedback.textContent = "Username is already taken.";
        submitButton.disabled = false;
        submitButton.textContent = "Save Changes";
        submitButton.style.opacity = "1";
        return;
      }
    }

    await updateUserProfile({
      username: newUsername,
      first_name: firstNameInput.value.trim(),
      last_name: lastNameInput.value.trim(),
      country: countrySelect.value,
      about: aboutInput.value.trim()
    });

    window.location.replace("/profile?success=profile_updated");
  } catch (err) {
    setMessage(err.message || "Failed to update profile", true);
    submitButton.disabled = false;
    submitButton.textContent = "Save Changes";
    submitButton.style.opacity = "1";
    checkFormDirty();
  }
}

async function initEditPage() {
  try {
    const auth = await requireAuth();
    if (!auth) return;

    populateAuthUI(auth.profile);
    bindLogoutButtons();

    // Store initial data
    initialData = {
      username: auth.profile.username || "",
      first_name: auth.profile.first_name || "",
      last_name: auth.profile.last_name || "",
      country: auth.profile.country || "",
      about: auth.profile.about || ""
    };

    // Pre-fill form
    usernameInput.value = initialData.username;
    firstNameInput.value = initialData.first_name;
    lastNameInput.value = initialData.last_name;
    countrySelect.value = initialData.country;
    aboutInput.value = initialData.about;
    counter.textContent = `${initialData.about.length}/300`;

    initLiveValidation();
    checkFormDirty();

    form.addEventListener("submit", handleFormSubmit);
  } catch (err) {
    console.error("Edit page init error:", err);
  }
}

initEditPage();
