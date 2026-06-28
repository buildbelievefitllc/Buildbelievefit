// src/components/SovereignStudioV4/markup.jsx
// Tiny inline-markup parser mirroring the v3 authoring convention:
//   **double stars** → bold (white emphasis)
//   *single stars*   → accent highlight (the card's primary/accent color)
// Newlines are preserved by the consumers' `white-space: pre-line`.
//
// Returns an array of React nodes, so callers render {renderMarkup(text, accent)}.

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function renderMarkup(text, accentColor) {
  if (!text) return null;
  const parts = String(text).split(TOKEN);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <b key={i} className="mk-bold">
          {part.slice(2, -2)}
        </b>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <span key={i} className="mk-hi" style={accentColor ? { color: accentColor } : undefined}>
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
