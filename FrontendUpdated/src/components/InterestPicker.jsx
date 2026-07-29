import React, { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, ApiError } from '../api/client.js';

export default function InterestPicker() {
  const { completeOnboarding } = useAuth();
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Free-text interests, independent of the starter-article list below.
  const [topicInput, setTopicInput] = useState('');
  const [topics, setTopics] = useState([]);

  useEffect(() => {
    api
      .starterArticles()
      .then((rows) => {
        setArticles(rows);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Could not load starter articles.');
        setStatus('error');
      });
  }, []);

  const toggleArticle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTopic = () => {
    const value = topicInput.trim();
    if (!value) return;
    setTopics((current) => (current.some((t) => t.toLowerCase() === value.toLowerCase()) ? current : [...current, value]));
    setTopicInput('');
  };

  const handleTopicKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTopic();
    }
  };

  const removeTopic = (value) => {
    setTopics((current) => current.filter((t) => t !== value));
  };

  const totalChosen = selected.size + topics.length;

  const handleSubmit = async () => {
    if (totalChosen === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await completeOnboarding(Array.from(selected), topics);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your interests. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl text-ink">A few things to start with</h1>
        <p className="mt-2 text-base text-muted">
          Search for topics you're curious about, or pick a few articles below — Aurelius will build your feed
          around them and refine it automatically as you read, upvote, and save.
        </p>
      </div>

      {/* Free-text interest search */}
      <div className="mb-8">
        <label htmlFor="topic-search" className="mb-1.5 block text-sm uppercase tracking-wider text-muted font-mono">
          Search for an interest
        </label>
        <div className="flex gap-2">
          <input
            id="topic-search"
            type="text"
            value={topicInput}
            onChange={(event) => setTopicInput(event.target.value)}
            onKeyDown={handleTopicKeyDown}
            placeholder="e.g. Stoic philosophy, black holes, Byzantine history…"
            className="flex-1 rounded-lg border border-border bg-surface px-3.5 py-3 text-base text-ink outline-none transition focus:border-accent"
          />
          <button
            type="button"
            onClick={addTopic}
            disabled={!topicInput.trim()}
            className="flex items-center gap-1 rounded-lg border border-border px-3.5 py-3 text-base text-ink transition hover:border-accent/60 disabled:opacity-40"
          >
            <Plus size={18} /> Add
          </button>
        </div>

        {topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span
                key={topic}
                className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-1 pl-3 pr-2 text-sm text-accent"
              >
                {topic}
                <button type="button" onClick={() => removeTopic(topic)} aria-label={`Remove ${topic}`}>
                  <X size={16} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <p className="text-sm uppercase tracking-wider text-muted font-mono">or pick some articles</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      {status === 'loading' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-surface2" />
          ))}
        </div>
      )}

      {status === 'error' && <p className="text-center text-base text-rust">{error}</p>}

      {status === 'ready' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {articles.map((article) => {
            const isSelected = selected.has(article.id);
            return (
              <button
                key={article.id}
                type="button"
                onClick={() => toggleArticle(article.id)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                  isSelected ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-accent/50'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    isSelected ? 'border-accent bg-accent text-surface' : 'border-border text-transparent'
                  }`}
                >
                  <Check size={15} />
                </span>
                <span>
                  <span className="block text-base font-medium text-ink">{article.title}</span>
                  {article.category && (
                    <span className="mt-0.5 block font-mono text-sm text-muted">{article.category}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && status === 'ready' && <p className="mt-4 text-center text-base text-rust">{error}</p>}

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={totalChosen === 0 || submitting}
          className="rounded-full bg-accent px-8 py-3 text-base font-medium text-surface transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Building your feed…' : `Start reading (${totalChosen} selected)`}
        </button>
      </div>
    </div>
  );
}
