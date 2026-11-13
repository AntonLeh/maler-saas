import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import HelpChat from './components/HelpChat.tsx'
import { inject } from '@vercel/analytics'
import { captureAttribution } from './lib/attribution'

// Herkunft aus Werbe-Links merken (nur im Speicher, keine Cookies) – vor dem ersten Rendern
captureAttribution()

// Besucherzahlen für maler-saas.com (Vercel Web Analytics, ohne Cookies).
// Nicht gezählt: angemeldete Nutzer (Betriebe, Mitarbeiter) und das Kundenportal.
// Adressen werden ohne Parameter übermittelt (keine Zugangslinks/Tokens).
inject({
  beforeSend: (event) => {
    try {
      const url = new URL(event.url)
      if (url.pathname.startsWith('/customer-view')) return null
      const loggedIn = Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (loggedIn) return null
      return { ...event, url: url.origin + url.pathname }
    } catch {
      return null
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="page-loading" role="status" aria-label="Wird geladen"><span /></div>}>
      <App />
    </Suspense>
    <HelpChat />
  </StrictMode>,
)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => {
      })
      .catch((error) => {
        console.error("Service Worker Fehler:", error);
      });
  });
}
