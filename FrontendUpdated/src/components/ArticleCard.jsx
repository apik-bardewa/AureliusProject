import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowBigUp,
  ArrowBigDown,
  Bookmark,
  Share2,
  MessageCircle,
  MoreVertical,
  ExternalLink,
  X,
  Send,
} from 'lucide-react';
import ArticleImage from './ArticleImage.jsx';
import WhyModal from './WhyModal.jsx';
import { api } from '../api/client.js';

// Comments have no backend support yet, so threads are kept in the
// browser's localStorage, scoped per article. This makes them feel real
// and persist across reloads on this device, but they are NOT shared with
// other users or other devices — a genuine multi-user comment system would
// need a `comments` table and endpoints on the backend.
const COMMENTS_KEY_PREFIX = 'aurelius-comments:';

function loadComments(articleId) {
  try {
    const raw = window.localStorage.getItem(`${COMMENTS_KEY_PREFIX}${articleId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (_error) {
    return [];
  }
}

function saveComments(articleId, comments) {
  try {
    window.localStorage.setItem(`${COMMENTS_KEY_PREFIX}${articleId}`, JSON.stringify(comments));
  } catch (_error) {
    // Storage unavailable (private browsing, quota) — comments just won't persist this session.
  }
}

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// action: 'none' | 'upvote' | 'downvote' — mirrors what the backend can store.
// onRemove: optional callback(articleId) — when provided, shows a remove ("X")
// control for contexts like the Saved Articles page.
export default function ArticleCard({ article, userId, onRemove }) {
  const [vote, setVote] = useState('none');
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [shareState, setShareState] = useState('idle'); // idle | copied
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(() => loadComments(article.id));
  const [commentDraft, setCommentDraft] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const logInteraction = (action) => {
    api.interact(userId, article.id, action).catch(() => {
      // Interaction logging is best-effort; a failed log shouldn't block the UI.
    });
  };

  const handleVote = (nextVote) => {
    const resolved = vote === nextVote ? 'none' : nextVote;
    setVote(resolved);
    if (resolved !== 'none') logInteraction(resolved);
  };

  const handleSave = () => {
    setSaved((current) => !current);
    logInteraction('save');
  };

  const handleShare = async () => {
    logInteraction('share');
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url: article.wiki_link });
        return;
      } catch (_error) {
        // user cancelled or share failed — fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(article.wiki_link);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 1800);
    } catch (_error) {
      // clipboard unavailable — nothing more we can do silently
    }
  };

  const handlePostComment = (event) => {
    event.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;
    const next = [...comments, { id: `${Date.now()}`, text, createdAt: new Date().toISOString() }];
    setComments(next);
    saveComments(article.id, next);
    setCommentDraft('');
  };

  return (
    <article className="relative w-full overflow-hidden rounded-2xl border border-t-2 border-border border-t-accent/70 bg-surface shadow-soft">
      {/* remove-from-saved control (Saved Articles page only) */}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(article.id)}
          aria-label="Remove from saved articles"
          title="Remove from saved articles"
          className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-rust"
        >
          <X size={18} />
        </button>
      )}

      {/* header row — category on the left, triple-dot menu on the right, like a post header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 font-display text-base text-accent">
            {(article.title || '?').trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-ink">{article.title}</p>
            {article.category && <p className="truncate font-mono text-sm text-muted">{article.category}</p>}
          </div>
        </div>

        {/* triple-dot menu → Why am I seeing this */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="More options"
            className="rounded-full p-2 text-muted hover:bg-surface2 hover:text-ink transition"
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-60 rounded-xl border border-border bg-surface shadow-soft animate-rise-in overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setWhyOpen(true);
                }}
                className="w-full px-4 py-3 text-left text-base text-ink hover:bg-surface2 transition"
              >
                Why am I seeing this?
              </button>
            </div>
          )}
        </div>
      </div>

      {/* image — full card width, fixed aspect ratio so it's always contained
          and consistent, the way a Facebook/Instagram feed image behaves */}
      <div className="aspect-[4/3] w-full bg-surface2 sm:aspect-video">
        <ArticleImage article={article} className="h-full w-full object-cover" />
      </div>

      <div className="px-4 pb-2 pt-4">
        <p className="text-base leading-relaxed text-ink line-clamp-5">{article.first_two_sentences}</p>

        <a
          href={article.wiki_link}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-flex w-fit items-center gap-1 text-sm font-mono text-accent hover:underline"
        >
          Read the original on Wikipedia <ExternalLink size={13} />
        </a>
      </div>

      {/* action bar */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2.5 text-muted">
        <button
          type="button"
          onClick={() => handleVote('upvote')}
          aria-pressed={vote === 'upvote'}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-base transition hover:bg-teal/10 ${
            vote === 'upvote' ? 'text-teal' : 'hover:text-teal'
          }`}
        >
          <ArrowBigUp size={23} fill={vote === 'upvote' ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={() => handleVote('downvote')}
          aria-pressed={vote === 'downvote'}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-base transition hover:bg-rust/10 ${
            vote === 'downvote' ? 'text-rust' : 'hover:text-rust'
          }`}
        >
          <ArrowBigDown size={23} fill={vote === 'downvote' ? 'currentColor' : 'none'} />
        </button>

        <button
          type="button"
          onClick={() => setCommentsOpen((open) => !open)}
          aria-pressed={commentsOpen}
          className={`ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-base transition hover:bg-surface2 ${
            commentsOpen ? 'text-ink' : 'hover:text-ink'
          }`}
        >
          <MessageCircle size={22} fill={commentsOpen ? 'currentColor' : 'none'} />
          {comments.length > 0 && <span className="font-mono text-sm">{comments.length}</span>}
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-base transition hover:bg-surface2 hover:text-ink"
        >
          <Share2 size={22} />
          {shareState === 'copied' && <span className="text-sm font-mono text-teal">Link copied</span>}
        </button>

        <button
          type="button"
          onClick={handleSave}
          aria-pressed={saved}
          className={`ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-base transition hover:bg-accent/10 ${
            saved ? 'text-accent' : 'hover:text-accent'
          }`}
        >
          <Bookmark size={22} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* comment thread — opens directly below the article when the comment
          icon is clicked, rather than in a separate modal */}
      {commentsOpen && (
        <div className="border-t border-border bg-surface2/50 px-4 py-4 animate-rise-in">
          {comments.length > 0 ? (
            <ul className="mb-3 space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-display text-sm text-accent">
                    Y
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl bg-surface px-3.5 py-2.5">
                    <p className="text-base leading-snug text-ink">{comment.text}</p>
                    <p className="mt-1 font-mono text-xs text-muted">{timeAgo(comment.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-muted">No comments yet — be the first to say something.</p>
          )}

          <form onSubmit={handlePostComment} className="flex items-center gap-2">
            <input
              type="text"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write a comment…"
              className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-base text-ink outline-none transition focus:border-accent"
            />
            <button
              type="submit"
              disabled={!commentDraft.trim()}
              aria-label="Post comment"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-surface transition hover:opacity-90 disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {whyOpen && <WhyModal userId={userId} articleId={article.id} onClose={() => setWhyOpen(false)} />}
    </article>
  );
}
