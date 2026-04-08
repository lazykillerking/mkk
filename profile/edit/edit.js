import { requireAuth, updateUserProfile, populateAuthUI, bindLogoutButtons } from "/js/session.js";

/**
 * Initializes the Profile Edit page.
 * Unlike the previous mock interaction script, this is now an ES module that directly
 * communicates with Supabase. It fetches the current user's record on load, pre-populates
 * the form fields, and submits updates securely back to the database.
 */
async function initEditPage() {
  try {
    // 1. Require a valid Supabase auth session; redirect to login if missing.
    const auth = await requireAuth();
    if (!auth) return;

    // 2. Hydrate the shared navbar elements (username chip, score) using the fetched auth payload.
    populateAuthUI(auth.profile, auth.user);
    bindLogoutButtons();

    const usernameInput = document.getElementById('username');
    const firstNameInput = document.getElementById('first_name');
    const lastNameInput = document.getElementById('last_name');
    const countryInput = document.getElementById('country');
    const bioInput = document.getElementById('bio');
    
    const previewUsername = document.getElementById('preview-username');
    const previewBio = document.getElementById('preview-bio');
    const userCounter = document.getElementById('username-counter');
    const bioCounter = document.getElementById('bio-counter');
    const usernameMsg = document.getElementById('username-msg');
    const form = document.getElementById('edit-form');
    const saveBtn = document.getElementById('save-btn');

    if (auth.profile) {
      usernameInput.value = auth.profile.username || '';
      firstNameInput.value = auth.profile.first_name || '';
      lastNameInput.value = auth.profile.last_name || '';
      countryInput.value = auth.profile.country || '';
      bioInput.value = auth.profile.about || '';

      usernameInput.dispatchEvent(new Event('input'));
      bioInput.dispatchEvent(new Event('input'));
    }

    // Username Input -> Preview & Counter
    usernameInput.addEventListener('input', (e) => {
      const val = e.target.value;
      previewUsername.textContent = val.trim() || 'username';
      
      userCounter.textContent = `${val.length} / 24`;
      userCounter.className = 'char-counter';
      if (val.length >= 24) userCounter.classList.add('error');
      else if (val.length >= 20) userCounter.classList.add('warn');
    });

    // Bio Input -> Preview & Counter
    bioInput.addEventListener('input', (e) => {
      const val = e.target.value;
      previewBio.textContent = val.trim() || 'no bio set...';
      
      bioCounter.textContent = `${val.length} / 300`;
      bioCounter.className = 'char-counter';
      if (val.length >= 300) bioCounter.classList.add('error');
      else if (val.length >= 270) bioCounter.classList.add('warn');
    });

    // Username validation on blur
    const validateUsername = () => {
      const val = usernameInput.value;
      usernameInput.classList.remove('is-error');
      usernameMsg.style.display = 'none';

      if (val.length > 0 && val.length < 3) {
        usernameInput.classList.add('is-error');
        usernameMsg.textContent = 'too short';
        usernameMsg.style.display = 'inline';
        return false;
      }
      
      if (val.length > 0 && !/^[a-zA-Z0-9_]+$/.test(val)) {
        usernameInput.classList.add('is-error');
        usernameMsg.textContent = 'invalid characters';
        usernameMsg.style.display = 'inline';
        return false;
      }

      if (val.length === 0) {
        usernameInput.classList.add('is-error');
        usernameMsg.textContent = 'required';
        usernameMsg.style.display = 'inline';
        return false;
      }

      return true;
    };

    usernameInput.addEventListener('blur', validateUsername);

    // Form Submission via Save Changes button
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const isValid = validateUsername();
      
      if (!isValid) {
        usernameInput.focus();
        return;
      }

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const originalText = saveBtn.textContent;
      const originalColor = saveBtn.style.color;
      saveBtn.textContent = 'Saving...';
      saveBtn.classList.add('pulse-saving');
      saveBtn.style.color = 'var(--cyan)';
      saveBtn.disabled = true;
      
      try {
        await updateUserProfile({
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
          country: data.country,
          about: data.bio
        });

        saveBtn.classList.remove('pulse-saving');
        saveBtn.textContent = 'Saved \u2713';
        saveBtn.style.color = 'var(--green)';

        setTimeout(() => {
          window.location.href = '/profile?success=profile_updated';
        }, 800);
      } catch (err) {
        saveBtn.classList.remove('pulse-saving');
        saveBtn.textContent = 'Error';
        saveBtn.style.color = 'var(--red)';
        saveBtn.disabled = false;
        alert(err.message || "Failed to update profile.");
        
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.color = originalColor;
        }, 3000);
      }
    });

  } catch (error) {
    console.error(error);
    alert("Unable to initialize edit page.");
  }
}

initEditPage();
