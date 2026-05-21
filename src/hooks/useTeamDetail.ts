import { useState } from 'react'

export interface TeamDetailInfo {
  team:            { id: string; name: string; logo_url: string | null }
  competitionId:   string
  seasonYear:      number
  competitionName: string | null
}

export function useTeamDetail() {
  const [current, setCurrent] = useState<TeamDetailInfo | null>(null)
  return {
    current,
    open:  (info: TeamDetailInfo) => setCurrent(info),
    close: () => setCurrent(null),
  }
}
