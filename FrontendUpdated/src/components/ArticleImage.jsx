import React, { useEffect, useState } from 'react';
import ArticlePlate from './ArticlePlate.jsx';

// Simple in-memory cache so switching tabs/scrolling back doesn't
// re-fetch the same article's thumbnail from Wikipedia repeatedly.
const thumbnailCache = new Map();

function extractWikiSummaryUrl(wikiLink) {
  try {
    const url = new URL(wikiLink);
    const title = url.pathname.replace(/^\/wiki\//, '');
    if (!title) return null;
    // e.g. https://en.wikipedia.org -> api at https://en.wikipedia.org/api/rest_v1/page/summary/<title>
    return `${url.origin}/api/rest_v1/page/summary/${title}`;
  } catch (_error) {
    return null;
  }
}

export default function ArticleImage({ article, className = '' }) {
  const [thumbnailUrl, setThumbnailUrl] = useState(() => thumbnailCache.get(article.id) ?? undefined);

  useEffect(() => {
    if (thumbnailCache.has(article.id)) {
      setThumbnailUrl(thumbnailCache.get(article.id));
      return;
    }

    const summaryUrl = extractWikiSummaryUrl(article.wiki_link);
    if (!summaryUrl) {
      thumbnailCache.set(article.id, null);
      setThumbnailUrl(null);
      return;
    }

    let cancelled = false;
    fetch(summaryUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const url = data?.thumbnail?.source || null;
        thumbnailCache.set(article.id, url);
        if (!cancelled) setThumbnailUrl(url);
      })
      .catch(() => {
        thumbnailCache.set(article.id, null);
        if (!cancelled) setThumbnailUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [article.id, article.wiki_link]);

  // undefined = still loading, null = confirmed no image available
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={article.title}
        className={className}
        loading="lazy"
        onError={() => {
          thumbnailCache.set(article.id, null);
          setThumbnailUrl(null);
        }}
      />
    );
  }

  if (thumbnailUrl === undefined) {
    return <div className={`${className} bg-surface2 animate-pulse`} />;
  }

  // Confirmed no real thumbnail exists for this article — use the generated plate.
  return <ArticlePlate id={article.id} title={article.title} category={article.category} className={className} />;
}
