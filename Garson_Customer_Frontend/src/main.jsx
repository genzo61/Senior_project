import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    })
  })
}

if ('caches' in window) {
  window.addEventListener('load', () => {
    caches.keys().then((keys) => {
      const staleKeys = keys.filter((key) => /workbox|vite-pwa|sw-precache/i.test(key))
      staleKeys.forEach((key) => {
        caches.delete(key)
      })
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
