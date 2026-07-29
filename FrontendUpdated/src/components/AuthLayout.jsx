import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { Sun, Moon } from 'lucide-react';

export default function AuthLayout({ title, subtitle, children }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
        className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:text-ink hover:border-accent/60"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <svg width="34" height="34" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="13" r="12" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="1.4" />
            <path d="M13 5 L13 21 M6 13 L20 13" stroke="rgb(var(--color-accent))" strokeWidth="1.2" opacity="0.6" />
            <circle cx="13" cy="13" r="3.4" fill="rgb(var(--color-accent))" />
          </svg>
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">{children}</div>
      </div>
    </div>
  );
}
