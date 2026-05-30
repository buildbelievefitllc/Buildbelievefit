// src/components/PlaceholderCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Minimal reusable UI element proving the /components layer renders. Phase 1
// scaffolding only. Uses the locked BBF brand palette (Purple #6a0dad, Gold
// #f5c800) per CLAUDE.md §2.

export default function PlaceholderCard({ title, note }) {
  return (
    <div
      style={{
        border: '1px solid #1e1e1e',
        borderLeft: '3px solid #f5c800',
        borderRadius: 12,
        padding: '1rem 1.2rem',
        marginTop: '1rem',
        background: '#0e0e0e',
        color: '#f9f5ff',
        maxWidth: 560,
      }}
    >
      <div style={{ fontWeight: 800, letterSpacing: '0.5px' }}>{title}</div>
      {note ? <div style={{ fontSize: '0.8rem', color: '#9a9a9a', marginTop: 4 }}>{note}</div> : null}
    </div>
  );
}
