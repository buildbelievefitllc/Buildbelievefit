// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Router with auth-gated routing + persistent MasterLayout shell.
// Phase 11 — the protected root is now RBAC-gated by <AdminGuard>: only the
// admin/coach tier (role admin/trainer, or the akeem CEO fallback) may mount the
// Command Center. Everyone else is redirected (no session) or shown a standalone
// denial screen (authenticated non-admin) — they never render the shell.
//
//   /login  → public Login gate (username + PIN)
//   /       → AdminGuard → MasterLayout → CommandCenter   (admin tier only)

import { Routes, Route, Navigate } from 'react-router-dom';
import AdminGuard from './components/AdminGuard.jsx';
import Login from './pages/Login.jsx';
import CommandCenter from './pages/CommandCenter.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <AdminGuard>
            <CommandCenter />
          </AdminGuard>
        }
      />
      {/* Unknown paths fall back to the protected root, which itself gates. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
