import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Mode hors ligne : enregistrement du service worker (désactivable avec VITE_DISABLE_SW=1)
if ('serviceWorker' in navigator && import.meta.env['VITE_DISABLE_SW'] !== '1') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker non enregistré', err));
  });
}
