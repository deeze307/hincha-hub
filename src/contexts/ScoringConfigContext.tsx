import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchScoringConfig, DEFAULT_SCORING, type ScoringConfig } from '../services/scoringConfigService'

// Config de puntuación global (una fila). Se expone vía contexto para que el umbral
// de anticipación y los puntajes se muestren dinámicamente en toda la app.
const ScoringConfigContext = createContext<ScoringConfig>(DEFAULT_SCORING)

export function useScoringConfig(): ScoringConfig {
  return useContext(ScoringConfigContext)
}

export function ScoringConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ScoringConfig>(DEFAULT_SCORING)

  useEffect(() => {
    fetchScoringConfig().then(setConfig).catch(() => {})
  }, [])

  return (
    <ScoringConfigContext.Provider value={config}>
      {children}
    </ScoringConfigContext.Provider>
  )
}
