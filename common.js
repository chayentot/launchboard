const cfg = window.LAUNCHBOARD_CONFIG || {};
const sb = (cfg.supabaseUrl && cfg.supabaseKey && window.supabase)
  ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)
  : null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentUser = null;
let currentProfile = null;

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.style.display = 'block';
  clearTimeout(window._tt);
  window._tt = setTimeout(() => {
    element.style.display = 'none';
  }, 3300);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function badge(profile) {
  return profile?.is_verified
    ? '<span class="verified" title="Verified creator">●</span>'
    : '';
}

async function boot() {
  if (!sb) {
    toast('Supabase is not configured. Check config.js.');
    window.dispatchEvent(new CustomEvent('launchboard:ready'));
    return;
  }

  const { data, error } = await sb.auth.getSession();
  if (error) toast(error.message);

  currentUser = data?.session?.user || null;
  currentProfile = null;

  if (currentUser) {
    const profileResult = await sb
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (profileResult.error) toast(profileResult.error.message);
    currentProfile = profileResult.data || null;
  }

  renderNav();
  window.dispatchEvent(new CustomEvent('launchboard:ready'));
}

function renderNav() {
  const actions = $('#navActions');
  if (!actions) return;

  if (currentUser) {
    actions.innerHTML = `
      <a class="btn btn-ghost hide-mobile" href="dashboard.html">Dashboard</a>
      <a class="btn btn-ghost" href="messages.html">Messages</a>
      <button class="btn btn-primary" id="logout">Log out</button>`;
  } else {
    actions.innerHTML = `
      <button class="btn btn-ghost" id="openLogin">Log in</button>
      ${$('#signupModal') ? '<button class="btn btn-primary" id="openSignup">Join free</button>' : ''}`;
  }

  $('#openLogin')?.addEventListener('click', () => $('#loginModal')?.showModal());
  $('#openSignup')?.addEventListener('click', () => $('#signupModal')?.showModal());
  $('#logout')?.addEventListener('click', async () => {
    const { error } = await sb.auth.signOut();
    if (error) return toast(error.message);
    location.href = 'index.html';
  });
}

async function loginSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const { error } = await sb.auth.signInWithPassword({
    email: form.get('email'),
    password: form.get('password')
  });

  if (error) return toast(error.message);
  location.reload();
}

async function signupSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const { error } = await sb.auth.signUp({
    email: form.get('email'),
    password: form.get('password'),
    options: { data: { full_name: form.get('name') } }
  });

  if (error) return toast(error.message);
  toast('Account created. Check your email if confirmation is enabled.');
  event.target.closest('dialog')?.close();
}

window.addEventListener('DOMContentLoaded', () => {
  $('#loginForm')?.addEventListener('submit', loginSubmit);
  $('#signupForm')?.addEventListener('submit', signupSubmit);
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  boot();
});
