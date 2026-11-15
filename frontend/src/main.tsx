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

// Vorab gerenderte Produktseite (#ssr, nur für Google und den ersten Augenblick):
// die App baut sich unsichtbar auf und tauscht dann ohne Flackern aus
const rootEl = document.getElementById('root')!
const ssrEl = document.getElementById('ssr')
if (ssrEl && rootEl.dataset.ssr) {
  const swap = () => {
    if (!ssrEl.isConnected) return
    ssrEl.remove()
    rootEl.style.display = ''
    observer.disconnect()
  }
  const observer = new MutationObserver(() => {
    if (rootEl.childElementCount > 0 && !rootEl.querySelector('.page-loading')) requestAnimationFrame(swap)
  })
  observer.observe(rootEl, { childList: true, subtree: true })
  window.setTimeout(swap, 8000) // spätestens dann die App zeigen
}

createRoot(rootEl).render(
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
