// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Router with auth-gated routing + persistent MasterLayout shell.
//
//   /login  → public Login gate (username + PIN)
//   /       → protected: Dashboard rendered INSIDE MasterLayout if a user exists,
//             else redirect to /login. Gated on `loading` so we never redirect
//             before the persisted session has rehydrated.
//
// Future protected routes nest inside MasterLayout the same way.

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import MasterLayout from './components/MasterLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Don't decide until the persisted session is known (avoids redirect flash).
  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--mut)' }}>Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <MasterLayout>{children}</MasterLayout>;
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
