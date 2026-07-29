import React, { useEffect, useState, useCallback } from 'react';
import ArticleCard from './ArticleCard.jsx';
import { api, ApiError } from '../api/client.js';

function CardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-border bg-surface shadow-soft animate-pulse">
      <div className="h-40 w-48 shrink-0 bg-surface2" />
      <div className="flex-1 space-y-3 p-5">
        <div className="h-4 w-20 rounded bg-surface2" />
        <div className="h-5 w-2/3 rounded bg-surface2" />
        <div className="h-3 w-full rounded bg-surface2" />
        <div className="h-3 w-5/6 rounded bg-surface2" />
      </div>
    </div>
  );
}

export default function Feed({ userId }) {
  const [articles, setArticles] = useState([]);
  const [seenIds, setSeenIds] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | loading-more | error | empty
  const [error, setError] = useState('');

  const loadMore = useCallback(
    async (currentSeen) => {
      try {
        const rows = await api.feed(userId, currentSeen);
        if (rows.length === 0) {
          setStatus((prev) => (prev === 'loading' ? 'empty' : 'ready'));
          return;
        }
        setArticles((prev) => [...prev, ...rows]);
        setSeenIds((prev) => [...prev, ...rows.map((row) => row.id)]);
        setStatus('ready');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load your feed.');
        setStatus('error');
      }
    },
    [userId],
  );

  useEffect(() => {
    loadMore([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleLoadMore = () => {
    setStatus('loading-more');
    loadMore(seenIds);
  };

  if (status === 'loading') {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-rust/30 bg-rust/5 p-6 text-center">
        <p className="text-base text-rust">{error}</p>
      </div>
    );
  }

  if (status === 'empty' && articles.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <p className="font-display text-lg text-ink">Nothing new to read right now</p>
        <p className="mt-1 text-base text-muted">Check back later, or revisit your saved articles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} userId={userId} />
      ))}

      <div className="flex justify-center pt-2 pb-8">
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={status === 'loading-more'}
          className="rounded-full border border-border bg-surface px-7 py-3 text-base text-ink transition hover:border-accent/60 hover:text-accent disabled:opacity-50"
        >
          {status === 'loading-more' ? 'Finding more articles…' : 'Show me more'}
        </button>
      </div>
    </div>
  );
}
