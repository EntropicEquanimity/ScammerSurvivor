import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Base first, so every feature stylesheet that App pulls in lands after it in the bundle and wins ties.
import './base.css';
import { App } from './App.tsx';

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
