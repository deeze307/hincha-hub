import type { CompetitionMatch } from '../../../services/matchesService'
import type { PredMap, TeamRef } from '../../../utils/prodeScoring'
import { MatchRow } from '../../molecules/MatchRow'

const ROUND_LABELS: Record<string, string> = {
  'Round of 32':    '16avos de Final',
  'Round of 16':    'Octavos de Final',
  'Quarter-finals': 'Cuartos de Final',
  'Semi-finals':    'Semifinales',
  '3rd Place Final':'Tercer Puesto',
  'Final':          'Final',
}

export function KnockoutTab({
  roundsMap, predMap, onPred, onTeamClick, competitionCountry, competitionName,
}: {
  roundsMap:           Map<string, CompetitionMatch[]>
  predMap:             PredMap
  onPred:              (matchId: string, home: string, away: string) => void
  onTeamClick?:        (team: TeamRef) => void
  competitionCountry?: string
  competitionName?:    string
}) {
  if (roundsMap.size === 0) {
    return (
      <div className="card p-12 text-center text-muted">
        <p className="text-sm">Los partidos eliminatorios se cargarán cuando estén disponibles.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {[...roundsMap.entries()]
        .sort(([, a], [, b]) => (a[0]?.round_order ?? 0) - (b[0]?.round_order ?? 0))
        .map(([round, rMatches]) => (
          <div key={round} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-elevated/50">
              <h3 className="text-text text-sm font-semibold">
                {ROUND_LABELS[round] ?? round}
              </h3>
            </div>
            <div className="px-4">
              {rMatches
                .sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0))
                .map(m => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    pred={predMap.get(m.id) ?? { home: '', away: '', home_orig: '', away_orig: '', pts: null, is_modified: false, exists_in_db: false, predicted_at: null }}
                    onChange={(h, a) => onPred(m.id, h, a)}
                    onTeamClick={onTeamClick}
                    competitionCountry={competitionCountry}
                    competitionName={competitionName}
                  />
                ))
              }
            </div>
          </div>
        ))
      }
    </div>
  )
}
