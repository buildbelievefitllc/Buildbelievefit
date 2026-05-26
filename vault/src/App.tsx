import type { CSSProperties } from 'react';
import ClientDashboard from './components/ClientDashboard';
import NutritionVision from './components/NutritionVision';

export default function App() {
  return (
    <main style={styles.root}>
      <header style={styles.header}>
        <div style={styles.title}>BBF Vault React Architecture Active</div>
        <div style={styles.sub}>
          Phase 4.3 · twin-panel development surface · ClientDashboard ╳ NutritionVision
        </div>
      </header>
      <section style={styles.twin}>
        <ClientDashboard />
        <NutritionVision />
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1.5rem',
    background: '#0b0d10',
    color: '#e8eaed',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.01em' },
  sub: { fontSize: '0.85rem', opacity: 0.65 },
  twin: {
    display: 'grid',
    // auto-fit + minmax = the twin layout collapses to a single column
    // when the viewport is under ~600px (mobile portrait) and expands
    // to two columns when there's room. No media queries needed.
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
    flex: 1,
    minHeight: 0,
  },
};
