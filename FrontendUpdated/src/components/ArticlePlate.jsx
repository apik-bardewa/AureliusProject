import React, { useMemo } from 'react';

// The backend's `pages` table has no image column, so each article gets a
// deterministic generated "plate" — styled like an old encyclopedia
// illustration plate — instead of a missing/broken photo. Same article
// always renders the same plate.

const PALETTES = [
  ['#6E5A3E', '#A87A29'], // accent / walnut
  ['#2F5A4C', '#5CA891'], // teal / verdigris
  ['#5B3A3A', '#C46048'], // rust / clay
  ['#38415C', '#7A88B8'], // indigo / slate
  ['#4A3B57', '#9C7FB0'], // plum / lilac
  ['#3E4A2E', '#8FA35C'], // olive / moss
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function ArticlePlate({ id, title, category, className = '' }) {
  const { colors, initial, rings } = useMemo(() => {
    const seed = hashString(`${id}-${category || ''}`);
    const palette = PALETTES[seed % PALETTES.length];
    const letter = (title || '?').trim().charAt(0).toUpperCase() || '?';
    const ringSeed = (seed >> 3) % 5;
    return { colors: palette, initial: letter, rings: ringSeed };
  }, [id, title, category]);

  const gradientId = `plate-grad-${id}`;

  return (
    <svg
      viewBox="0 0 400 240"
      className={className}
      role="img"
      aria-label={`Illustration plate for ${title}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${gradientId})`} />
      {/* concentric rings, count varies by seed, evokes an engraved plate */}
      {Array.from({ length: 2 + rings }).map((_, index) => (
        <circle
          key={index}
          cx="330"
          cy="30"
          r={18 + index * 16}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
        />
      ))}
      <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
      <text
        x="24"
        y="150"
        fontFamily="'Newsreader', serif"
        fontSize="96"
        fill="rgba(255,255,255,0.9)"
        fontWeight="600"
      >
        {initial}
      </text>
    </svg>
  );
}
