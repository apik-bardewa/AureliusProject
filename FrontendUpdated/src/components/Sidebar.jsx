import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Bookmark, Settings, LogOut, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const linkBase =
  'flex items-center gap-3 rounded-lg px-3 py-3 text-base transition text-muted hover:text-ink hover:bg-surface2';
const linkActive = 'bg-surface2 text-ink font-medium';

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="fixed left-0 top-16 bottom-0 z-30 hidden w-60 flex-col justify-between border-r border-border bg-surface px-3 py-6 sm:flex">
      <nav className="space-y-1">
        <p className="px-3 pb-2 text-sm uppercase tracking-wider text-muted font-mono">Library</p>
        <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          <Home size={20} /> Home feed
        </NavLink>
        <NavLink to="/bookmarks" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          <Bookmark size={20} /> Saved articles
        </NavLink>

        <p className="px-3 pb-2 pt-6 text-sm uppercase tracking-wider text-muted font-mono">Account</p>
        <NavLink to="/settings" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          <Settings size={20} /> Settings
        </NavLink>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/signin');
          }}
          className={`${linkBase} w-full text-left hover:text-rust`}
        >
          <LogOut size={20} /> Log out
        </button>
      </nav>

      <div className="rounded-xl border border-border bg-surface2 px-3 py-4">
        <div className="flex items-center gap-2 text-accent mb-1">
          <Compass size={18} />
          <p className="text-sm font-mono uppercase tracking-wider">Tip</p>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Tap the <span className="text-ink">•••</span> on any article to see why it was recommended to you.
        </p>
      </div>
    </aside>
  );
}
