import React, { useEffect, useState } from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Footer from './Footer.jsx';
import ArticleCard from './ArticleCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, ApiError } from '../api/client.js';

export default function Bookmarks() {
  const { user, token } = useAuth();
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error | empty
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .bookmarks(token)
      .then((rows) => {
        if (cancelled) return;
        setArticles(rows);
        setStatus(rows.length === 0 ? 'empty' : 'ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load your saved articles.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRemove = (articleId) => {
    // Optimistic: remove from the list immediately, roll back if the request fails.
    const previous = articles;
    const next = articles.filter((article) => article.id !== articleId);
    setArticles(next);
    if (next.length === 0) setStatus('empty');

    api.removeBookmark(token, articleId).catch(() => {
      setArticles(previous);
      setStatus('ready');
    });
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <Sidebar />
      <main className="pt-16 sm:pl-60">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
          <h1 className="mb-6 font-display text-2xl text-ink">Saved articles</h1>

          {status === 'loading' && (
            <div className="space-y-5">
              {[0, 1].map((key) => (
                <div key={key} className="h-40 animate-pulse rounded-2xl bg-surface2" />
              ))}
            </div>
          )}

          {status === 'error' && <p className="text-base text-rust">{error}</p>}

          {status === 'empty' && (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center">
              <p className="font-display text-lg text-ink">Nothing saved yet</p>
              <p className="mt-1 text-base text-muted">
                Tap the bookmark icon on an article in your feed to keep it here.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-5">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} userId={user.userId} onRemove={handleRemove} />
              ))}
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
}
