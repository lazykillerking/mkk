document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const bioInput = document.getElementById('bio');
  const previewUsername = document.getElementById('preview-username');
  const previewBio = document.getElementById('preview-bio');
  const userCounter = document.getElementById('username-counter');
  const bioCounter = document.getElementById('bio-counter');
  const usernameMsg = document.getElementById('username-msg');
  const form = document.getElementById('edit-form');
  const saveBtn = document.getElementById('save-btn');

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
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const isValid = validateUsername();
    
    if (!isValid) {
      usernameInput.focus();
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Update button to loading state
    const originalText = saveBtn.textContent;
    const originalColor = saveBtn.style.color;
    saveBtn.textContent = 'Saving...';
    saveBtn.classList.add('pulse-saving');
    saveBtn.style.color = 'var(--cyan)';
    
    // Simulate API call for now as requested
    setTimeout(() => {
      console.log('Form values saved:', data);
      
      // Update button to success state
      saveBtn.classList.remove('pulse-saving');
      saveBtn.textContent = 'Saved ✓';
      saveBtn.style.color = 'var(--green)';

      // Revert button after 1.5s
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.color = originalColor;
      }, 1500);

    }, 800); // simulated network delay
  });
});
