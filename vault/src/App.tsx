export default function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        background: '#0b0d10',
        color: '#e8eaed',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ margin: 0, fontSize: '1.75rem', letterSpacing: '0.01em' }}>
        BBF Vault React Architecture Active
      </h1>
      <p style={{ margin: 0, opacity: 0.72, fontSize: '0.95rem' }}>
        Phase 4.1 scaffold · Vite + React + TypeScript
      </p>
    </main>
  );
}
