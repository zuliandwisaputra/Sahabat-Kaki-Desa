import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font Nunito disimpan di proyek (tidak memuat dari Google) supaya cepat & tetap tampil
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
