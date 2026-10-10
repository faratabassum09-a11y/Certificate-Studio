import React, { useState } from 'react';
import { useAuth } from '../context/Auth.jsx';

export default function Login() {
  const { status, login, signup } = useAuth();
  const [modeChoice, setModeChoice] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // With no accounts yet, the first visitor creates the admin account.
  const mode = !status.hasUsers ? 'signup' : modeChoice;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await signup({ name, email, password });
      else await login(email, password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={submit}>
        <h1 className="brand-lg">Certificate Studio</h1>
        <p className="muted">
          {mode === 'signup'
            ? status.hasUsers ? 'Create your account' : 'First-time setup — create the admin account'
            : 'Sign in to continue'}
        </p>

        {mode === 'signup' && (
          <label className="field">
            <span>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={mode === 'login'} />
        </label>
        <label className="field">
          <span>Password{mode === 'signup' ? ' (min 8 characters)' : ''}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'signup' ? 8 : undefined}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        {status.hasUsers && status.allowSignup && (
          <p className="muted center-text">
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <a href="#" onClick={(e) => { e.preventDefault(); setError(''); setModeChoice(mode === 'login' ? 'signup' : 'login'); }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </a>
          </p>
        )}
        {status.hasUsers && !status.allowSignup && (
          <p className="muted center-text">Need access? Ask an admin to create your account.</p>
        )}
      </form>
    </div>
  );
}
