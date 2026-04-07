import { getSupabaseConfigError, requireSupabaseClient } from "./supabase.js";

// Centralizing route constants keeps redirects consistent across pages.
const ROUTES = {
  login: "/index.html",
  dashboard: "/dashboard/"
};

// Friendly fallback usernames prevent the UI from collapsing if a profile row is still missing.
function deriveUsername(user) {
  const metadataUsername = user?.user_metadata?.username;
  if (metadataUsername) {
    return String(metadataUsername).trim();
  }

  const email = user?.email || "";
  const emailName = email.split("@")[0];
  return emailName || "player";
}

// Shared redirect helper makes auth transitions easier to change later.
function redirect(path) {
  window.location.replace(path);
}

// Error text is normalized so every page shows the same messages for the same problems.
function normalizeProfileInsertError(error) {
  const code = error?.code || "";
  const message = (error?.message || "").toLowerCase();

  if (code === "23505" && message.includes("username")) {
    return "That username is already taken. Choose another username and try again.";
  }

  if (code === "23505" && message.includes("users_pkey")) {
    return "Your profile already exists. Try logging in again.";
  }

  return error?.message || "Unable to create your player profile right now.";
}

// Public helper returns the authenticated Supabase Auth user or null when signed out.
export async function getAuthUser() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user || null;
}

// This provides a single source of truth for username validation rules.
export function validateUsername(username) {
  return /^[A-Za-z0-9_]{3,24}$/.test(String(username || "").trim());
}

// Username checks are best-effort because some RLS setups may not allow anonymous reads.
export async function isUsernameAvailable(username) {
  const client = requireSupabaseClient();
  const cleanedUsername = String(username || "").trim();

  if (!cleanedUsername) {
    return false;
  }

  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("username", cleanedUsername)
    .maybeSingle();

  if (error) {
    return true;
  }

  return !data;
}

// Profile creation is reusable so signup and post-login recovery can both rely on the same logic.
export async function ensureUserProfile(user, preferredUsername) {
  const client = requireSupabaseClient();

  if (!user?.id) {
    throw new Error("Missing authenticated user information.");
  }

  const { data: existingProfile, error: existingProfileError } = await client
    .from("users")
    .select("id, username, score, created_at, first_name, last_name, country, about")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const username = String(preferredUsername || deriveUsername(user)).trim();
  const { data: insertedProfile, error: insertError } = await client
    .from("users")
    .insert({
      id: user.id,
      username: username,
      score: 0
    })
    .select("id, username, score, created_at, first_name, last_name, country, about")
    .single();

  if (insertError) {
    throw new Error(normalizeProfileInsertError(insertError));
  }

  return insertedProfile;
}

// Every protected page can call this to fetch the profile row that backs public leaderboard data.
export async function getCurrentUserProfile() {
  const client = requireSupabaseClient();
  const user = await getAuthUser();

  if (!user) {
    return null;
  }

  const recoveredProfile = await ensureUserProfile(user);
  const { data: profile, error } = await client
    .from("users")
    .select("id, username, score, created_at, first_name, last_name, country, about")
    .eq("id", user.id)
    .single();

  if (error) {
    return recoveredProfile;
  }

  return profile;
}

// Protected routes call this before rendering sensitive UI.
export async function requireAuth(options = {}) {
  const redirectTo = options.redirectTo || ROUTES.login;
  const client = requireSupabaseClient();

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    redirect(redirectTo);
    return null;
  }

  const profile = await getCurrentUserProfile();

  client.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_OUT" || !session) {
      redirect(redirectTo);
    }
  });

  return {
    user: data.user,
    profile: profile
  };
}

// Logout is shared by the navbar power button and any future settings pages.
export async function logout() {
  const client = requireSupabaseClient();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }

  redirect(ROUTES.login);
}

// Navbar and page headers use data attributes so the same helper can hydrate multiple layouts.
export function populateAuthUI(profile) {
  if (!profile) {
    return;
  }

  document.querySelectorAll("[data-auth-username]").forEach(function (node) {
    node.textContent = profile.username;
  });

  document.querySelectorAll("[data-auth-score]").forEach(function (node) {
    const scoreValue = Number(profile.score || 0).toLocaleString("en-US");
    node.textContent = scoreValue;
  });

  document.querySelectorAll("[data-auth-created-at]").forEach(function (node) {
    const createdAt = profile.created_at ? new Date(profile.created_at) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      return;
    }

    node.textContent = createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long"
    });
  });
}

// Any button marked for logout automatically gets the same sign-out behavior.
export function bindLogoutButtons() {
  document.querySelectorAll("[data-logout-button]").forEach(function (button) {
    if (button.dataset.logoutBound === "true") {
      return;
    }

    button.dataset.logoutBound = "true";
    button.addEventListener("click", async function () {
      button.disabled = true;
      try {
        await logout();
      } catch (error) {
        button.disabled = false;
        window.alert(error?.message || "Unable to sign out right now.");
      }
    });
  });
}

// Auth pages use this to keep signed-in users out of the login/signup screen.
export async function redirectAuthenticatedUser() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  if (data.session) {
    redirect(ROUTES.dashboard);
  }
}

// Setup failures are easier to show via one small reusable message.
export function getSetupMessage() {
  return getSupabaseConfigError();
}

// Submits the updated profile data to the backend. Enforced by RLS matching user.id.
export async function updateUserProfile(profileData) {
  const client = requireSupabaseClient();
  const user = await getAuthUser();
  
  if (!user) {
    throw new Error("You must be signed in to edit your profile.");
  }

  if (profileData.username && !validateUsername(profileData.username)) {
    throw new Error("Username must be 3-24 characters and use only letters, numbers, or underscores.");
  }

  const payload = {
    username: profileData.username,
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    country: profileData.country,
    about: profileData.about
  };

  const { data, error } = await client
    .from("users")
    .update(payload)
    .eq("id", user.id)
    .select("id, username, score, created_at, first_name, last_name, country, about")
    .single();

  if (error) {
    throw new Error(normalizeProfileInsertError(error));
  }

  return data;
}
