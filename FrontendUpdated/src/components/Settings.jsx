import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Footer from './Footer.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <Sidebar />
      <main className="pt-16 sm:pl-60">
        <div className="mx-auto max-w-xl px-4 py-8 sm:px-8">
          <h1 className="mb-6 font-display text-2xl text-ink">Settings</h1>

          <section className="mb-5 rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-sm uppercase tracking-wider text-muted font-mono">Profile</p>
            <dl className="space-y-2 text-base">
              <div className="flex justify-between">
                <dt className="text-muted">Name</dt>
                <dd className="text-ink">{user?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Email</dt>
                <dd className="text-ink">{user?.email}</dd>
              </div>
            </dl>
          </section>

          <section className="mb-5 rounded-2xl border border-border bg-surface p-5">
            <p className="mb-3 text-sm uppercase tracking-wider text-muted font-mono">Appearance</p>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-base text-ink transition hover:border-accent/60"
            >
              <span className="flex items-center gap-2">
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </span>
              <span className="text-sm text-muted font-mono">Tap to switch</span>
            </button>
          </section>

          <section className="rounded-2xl border border-rust/30 bg-rust/5 p-5">
            <p className="mb-3 text-sm uppercase tracking-wider text-rust font-mono">Session</p>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/signin');
              }}
              className="flex items-center gap-2 rounded-lg border border-rust/40 px-4 py-3 text-base text-rust transition hover:bg-rust/10"
            >
              <LogOut size={16} /> Log out of Aurelius
            </button>
          </section>
        </div>
        <Footer />
      </main>
    </div>
  );
}
