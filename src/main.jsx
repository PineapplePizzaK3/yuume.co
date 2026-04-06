import { Buffer } from 'buffer'
window.Buffer = Buffer

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { refreshFxRate } from './lib/fx'
import './i18n/i18n.js'
import App from './App.jsx'
import './index.css'

void refreshFxRate()
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    void refreshFxRate()
  }, 1000 * 60 * 60)
}

const root = document.getElementById('root')
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
)

