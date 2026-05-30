// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Root router for the BBF React app. Phase 1 scaffolding: a single placeholder
// route proving Router + AuthProvider + the /pages and /components layers all
// render. Real routes (Command Center, Client Hub, Vault, Athlete Portal) land
// in later phases.

import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
