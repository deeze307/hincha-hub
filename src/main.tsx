import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

// Captura el evento lo antes posible, antes de que React monte
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  ;(window as any).__pwaInstallPrompt = e
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
