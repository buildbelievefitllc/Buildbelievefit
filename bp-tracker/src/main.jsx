import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerServiceWorker } from './lib/push.js'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register the service worker for offline shell + Web Push. Non-blocking:
// a failure here must never stop the user from logging a reading.
registerServiceWorker()
