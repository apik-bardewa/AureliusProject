import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { api, ApiError } from '../api/client.js';

export default function WhyModal({ userId, articleId, onClose }) {
  const [state, setState] = useState('loading'); // loading | done | error
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState('loading');
      try {
        const result = await api.explain(userId, articleId);
        if (!cancelled) {
          setData(result);
          setState('done');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load an explanation right now.');
          setState('error');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, articleId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-surface p-6 shadow-soft animate-rise-in sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Why am I seeing this article"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles size={17} />
            <h2 className="font-display text-lg text-ink">Why am I seeing this?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink transition"
          >
            <X size={18} />
          </button>
        </div>

        {state === 'loading' && (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-full rounded bg-surface2" />
            <div className="h-3 w-5/6 rounded bg-surface2" />
            <div className="h-3 w-2/3 rounded bg-surface2" />
          </div>
        )}

        {state === 'error' && (
          <p className="text-base text-rust">{error}</p>
        )}

        {state === 'done' && data && (
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-ink">{data.explanation}</p>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(4, Math.round((data.affinity_score ?? 0) * 100))}%` }}
                />
              </div>
              <span className="font-mono text-xs text-muted whitespace-nowrap">
                {Math.round((data.affinity_score ?? 0) * 100)}% match
              </span>
            </div>

            {data.matched_category && (
              <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs text-accent">
                Matches your interest in {data.matched_category}
              </span>
            )}

            {data.based_on && data.based_on.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted font-mono">Based on articles you liked</p>
                <ul className="space-y-1.5">
                  {data.based_on.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-base">
                      <span className="text-ink truncate pr-2">{item.title}</span>
                      <span className="font-mono text-xs text-muted shrink-0">{Math.round(item.similarity * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
