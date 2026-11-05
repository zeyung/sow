import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/700.css'
import '@fontsource/ibm-plex-mono/700-italic.css'
import './sow.css'
import Hero from './Hero'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Hero />
  </StrictMode>,
)
