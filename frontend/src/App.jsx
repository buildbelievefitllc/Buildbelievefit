// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Barebones router with auth-gated routing. No styling (intentional).
//
//   /login  → public placeholder
//   /       → protected: renders the Dashboard if a user exists, else redirects
//             to /login. Gated on `loading` so we never redirect before the
//             initial Supabase session has resolved.
//
// Placeholder route bodies are temporary and live in src/pages/. Real views land
// in later phases.

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Don't decide until the initial session is known (avoids redirect flash).
  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      {/* Unknown paths fall back to the protected root, which itself gates. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
