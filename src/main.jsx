// Punto de entrada de la app. Aplica el tema del brand antes de renderizar
// para que los colores estén disponibles desde el primer frame.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyBrandTheme } from './config/brand'
import App from './App.jsx'
import { AppProvider } from './context/AppContext'
import { ConfirmProvider } from './context/ConfirmContext'
import ErrorBoundary from './components/ErrorBoundary.jsx'

applyBrandTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
)
