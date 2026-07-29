import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-border px-6 py-8 text-xs text-muted">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="font-display italic">"You have power over your mind — not outside events."</p>
        <p className="font-mono">Aurelius © {new Date().getFullYear()} — built on Wikipedia</p>
      </div>
    </footer>
  );
}
