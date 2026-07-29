import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiError } from '../api/client.js';
import AuthLayout from './AuthLayout.jsx';

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signup(name, email, password);
      // Home will detect hasProfile === false and show the interest picker.
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="A feed that adapts to what you actually read.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm uppercase tracking-wider text-muted font-mono">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-base text-ink outline-none transition focus:border-accent"
            placeholder="Marcus Aurelius"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="mb-1.5 block text-sm uppercase tracking-wider text-muted font-mono">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-base text-ink outline-none transition focus:border-accent"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="mb-1.5 block text-sm uppercase tracking-wider text-muted font-mono">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-base text-ink outline-none transition focus:border-accent"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm uppercase tracking-wider text-muted font-mono">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-base text-ink outline-none transition focus:border-accent"
            placeholder="Repeat your password"
          />
        </div>

        {error && <p className="text-base text-rust">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent py-3 text-base font-medium text-surface transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-base text-muted">
        Already reading with us?{' '}
        <Link to="/signin" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
