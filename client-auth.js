(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const API_BASE = String(window.ZYMA_PORTAL_CONFIG?.apiBaseUrl || 'https://api.zyma.co.za').replace(/\/$/, '');
  const api = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      ...options
    });
    if (!response.ok) {
      let detail = '';
      try { const body = await response.json(); detail = body.message || body.title || ''; } catch (_) {}
      const error = new Error(detail || (response.status === 404 ? 'This portal service is not available yet.' : response.status === 401 ? 'Please sign in to continue.' : 'The request could not be completed.'));
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };
  const setMessage = (id, message, success = false) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = message; el.classList.toggle('success', success); }
  };
  const safeError = error => error.status === 404 || error instanceof TypeError
    ? 'Client portal access is not connected yet. Please try again once the shared API is available.'
    : error.message || 'The request could not be completed. Please try again.';

  document.querySelectorAll('[data-toggle-password]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Show' : 'Hide';
    button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
  }));

  const loginForm = $('#client-login-form');
  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const submit = loginForm.querySelector('[type="submit"]');
    const data = new FormData(loginForm);
    submit.disabled = true;
    setMessage('login-message', '');
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: String(data.get('email') || '').trim().toLowerCase(), password: String(data.get('password') || ''), audience: 'client_portal' }) });
      const user = result?.user || result;
      if (!user || !['client', 'client_admin', 'client_user'].includes(String(user.role || '').toLowerCase())) {
        setMessage('login-message', 'This account does not have client portal access. Contact your Zyma representative.');
        return;
      }
      window.location.href = 'client-portal.html';
    } catch (error) { setMessage('login-message', safeError(error)); }
    finally { submit.disabled = false; }
  });

  const registerForm = $('#client-register-form');
  if (registerForm) {
    const inviteInput = registerForm.querySelector('[name="inviteCode"]');
    const invitationToken = new URLSearchParams(window.location.search).get('token') || '';
    if (inviteInput && invitationToken) { inviteInput.value = invitationToken; inviteInput.readOnly = true; }
  }
  if (registerForm) registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!registerForm.reportValidity()) return;
    const data = new FormData(registerForm);
    const password = String(data.get('password') || '');
    const confirm = String(data.get('confirmPassword') || '');
    if (password.length < 12) { setMessage('register-message', 'Use a password with at least 12 characters.'); return; }
    if (password !== confirm) { setMessage('register-message', 'The passwords do not match.'); return; }
    const submit = registerForm.querySelector('[type="submit"]');
    submit.disabled = true;
    setMessage('register-message', '');
    try {
      await api('/api/invitations/accept', { method: 'POST', body: JSON.stringify({
        token: String(data.get('inviteCode') || '').trim(),
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim().toLowerCase(),
        password
      }) });
      setMessage('register-message', 'Your account has been activated. You can now sign in.', true);
      registerForm.reset();
      window.setTimeout(() => { window.location.href = 'client-login.html'; }, 900);
    } catch (error) { setMessage('register-message', safeError(error)); }
    finally { submit.disabled = false; }
  });

  const resetForm = $('#client-reset-form');
  if (resetForm) resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!resetForm.reportValidity()) return;
    const submit = resetForm.querySelector('[type="submit"]');
    const data = new FormData(resetForm);
    submit.disabled = true;
    setMessage('reset-message', '');
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: String(data.get('email') || '').trim().toLowerCase(), audience: 'client_portal' }) });
      setMessage('reset-message', 'If an eligible account exists, reset instructions will be sent to its email address.', true);
      resetForm.reset();
    } catch (error) { setMessage('reset-message', safeError(error)); }
    finally { submit.disabled = false; }
  });
  const newPasswordForm = document.getElementById('client-new-password-form');
  if (newPasswordForm) newPasswordForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!newPasswordForm.reportValidity()) return;
    const data = new FormData(newPasswordForm);
    const password = String(data.get('password') || '');
    const confirm = String(data.get('confirmPassword') || '');
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) { setMessage('new-password-message', 'This reset link is missing its token. Request a new password-reset link.'); return; }
    if (password.length < 12) { setMessage('new-password-message', 'Use a password with at least 12 characters.'); return; }
    if (password !== confirm) { setMessage('new-password-message', 'The passwords do not match.'); return; }
    const submit = newPasswordForm.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      await api('/api/auth/reset-password', { method:'POST', body:JSON.stringify({ token, password, audience:'client_portal' }) });
      setMessage('new-password-message', 'Your password has been updated. You can now sign in.', true);
      newPasswordForm.reset();
      window.setTimeout(()=>{ window.location.href='client-login.html'; }, 900);
    } catch(error) { setMessage('new-password-message', safeError(error)); }
    finally { submit.disabled = false; }
  });

})();
