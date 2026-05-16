import axios from 'axios'

// Instancia base para APIs externas (API-Football, etc.)
const api = axios.create({
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

export default api
