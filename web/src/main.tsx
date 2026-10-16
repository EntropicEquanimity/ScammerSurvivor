import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Base first, so every feature stylesheet that App pulls in lands after it in the bundle and wins ties.
import './base.css';
import { App } from './App.tsx';

// A tab left open across an update asks for asset files that no longer exist: reload onto the new
// version instead of breaking (once per minute at most, so a real outage cannot loop).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const last = Number(sessionStorage.getItem('reloadedAt') ?? 0);
  if (Date.now() - last < 60_000) return;
  sessionStorage.setItem('reloadedAt', String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Install is a nice-to-have. The practice works without it.
  });
}
