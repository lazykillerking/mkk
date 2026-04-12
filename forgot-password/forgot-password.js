const SUPABASE_URL = "https://jhyymmvbovpbuaobegcu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoeXltbXZib3ZwYnVhb2JlZ2N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Nzc3MDksImV4cCI6MjA5MTA1MzcwOX0.FV90_X3a1DAnLel998Dl93N_UhR7n81w8nTPyMbX-Xw";

console.log("[MKK Recovery] Step 1: window.supabase =", typeof window.supabase, window.supabase);

let supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  console.log("[MKK Recovery] Step 2: Client created successfully:", supabase);
  console.log("[MKK Recovery] Step 2b: supabase.auth =", supabase.auth);
  console.log("[MKK Recovery] Step 2c: resetPasswordForEmail =", typeof supabase.auth.resetPasswordForEmail);
} catch (initError) {
  console.error("[MKK Recovery] FATAL: Client creation failed:", initError);
}

const RESET_REDIRECT_URL = "https://mkk.lazykillerking.xyz/reset-password/";

const forgotForm = document.getElementById("forgot-form");
const emailInput = document.getElementById("forgot-email");
const messageElement = document.getElementById("forgot-message");
const submitButton = document.getElementById("forgot-submit");

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
  console.log("[MKK Recovery] Step 3: Form submitted");

  const email = emailInput.value.trim();
  setMessage("", "");

  if (!isValidEmail(email)) {
    setMessage("Enter a valid email address before requesting recovery.", "is-error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "transmitting...";

  try {
    console.log("[MKK Recovery] Step 4: Calling resetPasswordForEmail for:", email);
    console.log("[MKK Recovery] Step 4b: redirectTo:", RESET_REDIRECT_URL);

    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_REDIRECT_URL
    });

    console.log("[MKK Recovery] Step 5: Full result:", JSON.stringify(result));

    const { data, error } = result;

    if (error) {
      console.error("[MKK Recovery] Step 5b: Error from Supabase:", error);
      throw error;
    }

    console.log("[MKK Recovery] Step 6: SUCCESS - data:", data);
    setMessage("Recovery link transmitted. Check your inbox for the reset portal.", "is-success");
    submitButton.textContent = "> LINK SENT";
    submitButton.classList.add("is-success");
  } catch (error) {
    console.error("[MKK Recovery] CATCH:", error);
    submitButton.disabled = false;
    submitButton.textContent = "> SEND RESET LINK";
    submitButton.classList.remove("is-success");
    setMessage(error?.message || "Unable to send the recovery link right now. Try again.", "is-error");
  }
});
