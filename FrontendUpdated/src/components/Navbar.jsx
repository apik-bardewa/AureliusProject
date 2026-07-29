import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, ChevronDown, LogOut, Settings as SettingsIcon, Bookmark } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initials = (user?.name || user?.email || 'A')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border bg-surface/90 backdrop-blur">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        {/* Left cluster: wordmark + theme toggle */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
              <circle cx="13" cy="13" r="12" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="1.4" />
              <path d="M13 5 L13 21 M6 13 L20 13" stroke="rgb(var(--color-accent))" strokeWidth="1.2" opacity="0.6" />
              <circle cx="13" cy="13" r="3.4" fill="rgb(var(--color-accent))" />
            </svg>
            <span className="font-display text-xl tracking-tight text-ink">Aurelius</span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:text-ink hover:border-accent/60"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>

        {/* Center: page tagline, hidden on small screens */}
        <p className="hidden md:block font-display italic text-base text-muted select-none">
          Read deliberately.
        </p>

        {/* Right: user profile */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 hover:border-accent/60 transition"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold text-sm font-mono">
              {initials}
            </span>
            <span className="hidden sm:block text-base text-ink max-w-[120px] truncate">{user?.name || 'Reader'}</span>
            <ChevronDown size={17} className="text-muted" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-surface shadow-soft animate-rise-in overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-base font-medium text-ink truncate">{user?.name}</p>
                <p className="text-sm text-muted truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/bookmarks');
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-base text-ink hover:bg-surface2 transition"
              >
                <Bookmark size={18} /> Saved articles
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-base text-ink hover:bg-surface2 transition"
              >
                <SettingsIcon size={18} /> Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  navigate('/signin');
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-base text-rust hover:bg-rust/10 transition"
              >
                <LogOut size={18} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
