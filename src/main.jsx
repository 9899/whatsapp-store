import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Admin from './Admin.jsx'

const path = window.location.pathname
const isAdmin = path === '/admin' || path === '/admin/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
)