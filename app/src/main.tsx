import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { DatabaseProvider } from './context/DatabaseContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <DatabaseProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DatabaseProvider>
    </LanguageProvider>
  </StrictMode>,
)
