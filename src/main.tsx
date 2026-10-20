import './lib/zod-setup' // must run before any schema is created
import { initInstall } from './lib/install'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App'
import PwaPrompts from './components/PwaPrompts'

initInstall() // the browser's install offer fires early and only once, so catch it right away

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaPrompts />
  </StrictMode>,
)
