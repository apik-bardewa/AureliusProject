import React from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Footer from './Footer.jsx';
import Feed from './Feed.jsx';
import InterestPicker from './InterestPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();

  // Newly signed-up (or pre-existing) accounts without a built profile see
  // the interest picker instead of the feed — the ML service needs at least
  // one article or topic before it can recommend anything.
  if (!user?.hasProfile) {
    return (
      <div className="min-h-screen bg-bg">
        <Navbar />
        <main className="pt-16">
          <InterestPicker />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <Sidebar />
      <main className="pt-16 sm:pl-60">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
          <h1 className="mb-6 font-display text-2xl text-ink">Your feed</h1>
          <Feed userId={user.userId} />
        </div>
        <Footer />
      </main>
    </div>
  );
}
