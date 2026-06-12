import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Save, Lock, CheckCircle, ChevronLeft, X, Trophy, Link2, RefreshCw, Info } from 'lucide-react'
import { TeamDetailSheet } from '../components/organisms/TeamDetailSheet'
import { useTeamDetail } from '../hooks/useTeamDetail'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { createInviteLink } from '../services/inviteService'
import { fetchTournamentRanking } from '../services/rankingService'
import type { RankingEntry } from '../services/rankingService'
import { isMatchLocked, calcGroupStandings, type ScoreInput, type TeamRef } from '../utils/prodeScoring'
import { useProdePredictions } from '../hooks/useProdePredictions'
import { MatchRow } from '../components/molecules/MatchRow'
import { GroupStandingsTable } from '../components/molecules/GroupStandingsTable'
import { BonusTab, type BonusTabHandle } from '../components/organisms/prode/BonusTab'
import { KnockoutTab } from '../components/organisms/prode/KnockoutTab'
import { ProdeRankingTab } from '../components/organisms/prode/ProdeRankingTab'

const EMPTY_PRED: ScoreInput = {
  home: '', away: '', home_orig: '', away_orig: '',
  pts: null, is_modified: false, exists_in_db: false, predicted_at: null,
}

type Tab = 'groups' | 'knockout' | 'bonus' | 'ranking'

export default function TournamentProdePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { showToast } = useToast()
  const { current: teamDetail, open: openTeamDetail, close: closeTeamDetail } = useTeamDetail()

  const {
    tournament, matches, predMap, loading, refreshing,
    setPred, refreshMatches, savePredictions,
    groupMatchesMap, knockoutRoundsMap, flatMatches, hasGroups,
    bonusLocked, anyUnlocked,
  } = useProdePredictions(id, () => navigate('/torneos'))

  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [tab,          setTab]          = useState<Tab>('groups')
  const [rulesOpen,    setRulesOpen]    = useState(false)
  const [rulesVisible, setRulesVisible] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [rankingEntries, setRankingEntries] = useState<RankingEntry[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)

  const myUserId = profile?.id ?? null
  const bonusRef = useRef<BonusTabHandle>(null)

  useEffect(() => {
    if (tab !== 'ranking' || !id) return
    setRankingLoading(true)
    fetchTournamentRanking(id)
      .then(setRankingEntries)
      .finally(() => setRankingLoading(false))
  }, [tab, id])

  function handleTeamClick(team: TeamRef) {
    if (!tournament?.competition_id) return
    openTeamDetail({
      team,
      competitionId:   tournament.competition_id,
      seasonYear:      (tournament as any).competition?.season_year ?? new Date().getFullYear(),
      competitionName: tournament.competition?.name ?? null,
    })
  }

  async function handleInvite() {
    if (!id) return
    try {
      const link = await createInviteLink(id)
      await navigator.clipboard.writeText(link)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2500)
    } catch { /* silently ignore clipboard errors */ }
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)
    try {
      await savePredictions()
      await bonusRef.current?.save()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      showToast('¡Predicciones guardadas!', 'success')
    } catch (err) {
      console.error('Error guardando:', err)
      showToast('Error al guardar. Intentá de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function onChangePred(matchId: string, home: string, away: string) {
    setPred(matchId, home, away)
    setSaved(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="text-brand animate-spin" />
      </div>
    )
  }

  if (!tournament) return null

  const config          = tournament.prode_config
  const isOwner         = tournament.created_by === myUserId
  const isSuperAdmin    = profile?.role === 'superadmin'
  const canManageAwards = (isOwner || isSuperAdmin) && !!(config?.has_bonus && config?.bonus_types?.length)
  const canInvite       = isOwner || isSuperAdmin
  const directQ         = config?.direct_qualifiers ?? 2
  const bestThird       = config?.best_third_count  ?? 0
  const compCountry     = tournament.competition?.country ?? ''
  const compName        = tournament.competition?.name ?? ''

  const tabs = [
    { key: 'groups',   label: hasGroups ? 'Grupos' : 'Partidos' },
    ...(config?.has_knockout ? [{ key: 'knockout', label: 'Eliminatoria' }] : []),
    ...(config?.has_bonus    ? [{ key: 'bonus',    label: 'Bonus' }]       : []),
    { key: 'ranking',  label: 'Ranking' },
  ] as { key: Tab; label: string }[]

  // Para competiciones planas (amistosos) el contador refleja solo los partidos visibles
  const countableMatches = hasGroups || knockoutRoundsMap.size > 0 ? matches : flatMatches
  const unlockedMatches  = countableMatches.filter(m => !isMatchLocked(m) && !(predMap.get(m.id)?.is_modified))
  const filledCount      = unlockedMatches.filter(m => {
    const p = predMap.get(m.id)
    return p && p.home !== '' && p.away !== ''
  }).length

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col gap-2">
        {/* Fila 1: back + nombre + premios */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/torneos')}
            className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-text text-xl font-semibold tracking-tight leading-tight">{tournament.name}</h1>
            <p className="text-muted text-sm mt-1">{compName} · Prode</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 mt-1 shrink-0">
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <button
                  onClick={refreshMatches}
                  disabled={refreshing}
                  title="Actualizar partidos"
                  className="shrink-0 flex items-center justify-center w-8 h-8 text-muted hover:text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                </button>
              )}
              {canInvite && (
                <button
                  onClick={handleInvite}
                  className={`shrink-0 flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                    inviteCopied
                      ? 'text-green-400 border-green-500/40 bg-green-500/10'
                      : 'text-muted hover:text-text bg-elevated hover:bg-elevated/80 border-border'
                  }`}
                >
                  <Link2 size={13} />
                  {inviteCopied ? '¡Copiado!' : 'Invitar'}
                </button>
              )}
            </div>
            {canManageAwards && (
              <button
                onClick={() => navigate(`/torneos/${id}/premios`)}
                className="shrink-0 flex items-center gap-1.5 text-xs text-muted hover:text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                <Trophy size={13} /> Premios
              </button>
            )}
          </div>
        </div>

        {/* Bases y condiciones */}
        <div className="flex justify-end">
          <button
            onClick={() => { setRulesOpen(true); setTimeout(() => setRulesVisible(true), 10) }}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg px-3 py-1.5 transition-colors"
          >
            <Info size={13} /> Bases y condiciones
          </button>
        </div>

        {/* Fila 2: estado / acciones */}
        {tab !== 'ranking' && (
          <div className="flex items-center justify-between gap-3 pl-11">
            {!anyUnlocked && tab !== 'bonus' ? (
              <div className="flex items-center gap-2 text-muted text-sm">
                <Lock size={14} />
                <span>Predicciones cerradas</span>
              </div>
            ) : (
              <>
                <span className="text-muted text-xs">
                  {tab === 'bonus'
                    ? 'Campeón, goleador y más'
                    : `${filledCount}/${unlockedMatches.length} partidos cargados`
                  }
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 shrink-0"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
                  {saved ? 'Guardado' : 'Guardar todo'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal bases y condiciones */}
      {rulesOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${rulesVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}`}
          onClick={() => { setRulesVisible(false); setTimeout(() => setRulesOpen(false), 300) }}
        >
          <div
            className={`bg-surface border border-border rounded-2xl w-full max-w-sm shadow-elevated transition-all duration-300 ease-out ${rulesVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <h2 className="text-text font-semibold text-[15px]">Bases y condiciones</h2>
              <button
                onClick={() => { setRulesVisible(false); setTimeout(() => setRulesOpen(false), 300) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-5 overflow-y-auto max-h-[70vh]">

              {/* Sistema de puntuación */}
              <div className="space-y-2.5">
                <p className="text-muted-dark text-[11px] font-semibold uppercase tracking-wider">Sistema de puntuación</p>
                <p className="text-muted text-xs leading-relaxed">
                  Dependiendo del momento en el que se realice la predicción es el puntaje máximo que recibirá en cada caso.
                  Si se realiza la predicción de un partido con más de <span className="text-green-400 font-semibold">24hs</span> de antelación, obtendrá el puntaje marcado en <span className="text-green-400 font-semibold">verde</span>, pero si modifica algún resultado o realiza la predicción con menos de <span className="text-yellow-400 font-semibold">24hs</span> de antelación, obtendrá como máximo el puntaje marcado en <span className="text-yellow-400 font-semibold">amarillo</span>.
                </p>
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center mb-1.5">
                    <span />
                    <span className="text-green-400 text-[10px] font-semibold text-right">≥ 24h antes</span>
                    <span className="text-yellow-400 text-[10px] font-semibold text-right">&lt; 24h antes</span>
                  </div>
                  {([
                    ['Resultado exacto',            12, 6],
                    ['Ganador + goles de 1 equipo',  8, 4],
                    ['Solo ganador / empate',         6, 3],
                    ['Goles de un equipo',            2, 1],
                  ] as [string, number, number][]).map(([label, early, late]) => (
                    <div key={label} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
                      <span className="text-muted text-xs">{label}</span>
                      <span className="text-green-400 text-xs font-bold text-right">+{early}</span>
                      <span className="text-yellow-400 text-xs font-bold text-right">+{late}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Información de pago — solo si hay fee */}
              {tournament.entry_fee && tournament.entry_fee > 0 && (
                <div className="space-y-2.5">
                  <p className="text-muted-dark text-[11px] font-semibold uppercase tracking-wider">Inscripción</p>
                  <p className="text-muted text-xs leading-relaxed">
                    Este torneo tiene un costo de{' '}
                    <span className="text-brand font-semibold">${tournament.entry_fee.toLocaleString('es-AR')}</span>{' '}
                    que deberá abonarse en efectivo o transferencia.
                  </p>
                  <div className="space-y-1.5">
                    {tournament.entry_fee_alias && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-muted text-xs flex-1">Alias para transferir</span>
                        <span className="text-text text-xs font-semibold">{tournament.entry_fee_alias}</span>
                      </div>
                    )}
                    {tournament.entry_fee_phone && (
                      <div className="flex items-center gap-2.5">
                        <span className="text-muted text-xs flex-1">Enviar comprobante a</span>
                        <span className="text-text text-xs font-semibold">{tournament.entry_fee_phone}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-muted-dark text-[11px] leading-relaxed">
                    Enviá el comprobante para que el administrador confirme tu pago.
                  </p>
                </div>
              )}

              {/* Distribución de premios — solo si hay fee */}
              {tournament.entry_fee && tournament.entry_fee > 0 && (
                <div className="space-y-2.5">
                  <p className="text-muted-dark text-[11px] font-semibold uppercase tracking-wider">Distribución de premios</p>
                  <div className="space-y-1.5">
                    {([
                      ['🏆', 'Del total recaudado va a premios', '90%'],
                      ['🥇', '1° puesto',                        '60% del pozo'],
                      ['🥈', '2° puesto',                        '30% del pozo'],
                      ['🥉', '3° puesto',                        '10% del pozo'],
                    ] as [string, string, string][]).map(([icon, label, value]) => (
                      <div key={label} className="flex items-center gap-2.5">
                        <span className="text-base leading-none w-5 text-center shrink-0">{icon}</span>
                        <span className="text-muted text-xs flex-1">{label}</span>
                        <span className="text-text text-xs font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-elevated p-1 rounded-md w-full sm:w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-1.5 rounded-[8px] text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.key ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Fase de Grupos / Partidos ── */}
      {tab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...groupMatchesMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([groupName, gMatches]) => (
            <div key={groupName} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-elevated/50">
                <h3 className="text-text text-sm font-semibold">{groupName || 'Grupo'}</h3>
              </div>
              <div className="px-4">
                {gMatches.map(m => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    pred={predMap.get(m.id) ?? EMPTY_PRED}
                    onChange={(h, a) => onChangePred(m.id, h, a)}
                    onTeamClick={handleTeamClick}
                    competitionCountry={compCountry}
                    competitionName={compName}
                  />
                ))}
              </div>
              <div className="px-4 pb-4">
                <GroupStandingsTable
                  standings={calcGroupStandings(gMatches, predMap)}
                  qualifiers={directQ}
                  showBestThird={bestThird > 0}
                />
              </div>
            </div>
          ))}

          {/* Partidos planos: sin grupo ni knockout (amistosos, etc.) */}
          {flatMatches.length > 0 && (
            <div className="col-span-2 card overflow-hidden">
              {flatMatches.map(m => (
                <MatchRow
                  key={m.id}
                  match={m}
                  pred={predMap.get(m.id) ?? EMPTY_PRED}
                  onChange={(h, a) => onChangePred(m.id, h, a)}
                  onTeamClick={handleTeamClick}
                  competitionCountry={compCountry}
                  competitionName={compName}
                />
              ))}
            </div>
          )}

          {groupMatchesMap.size === 0 && flatMatches.length === 0 && (
            <div className="col-span-2 card p-12 text-center text-muted">
              No hay partidos cargados aún.
              <p className="text-xs text-muted-dark mt-2">
                Ejecutá la función <code>sync-fixtures</code> desde Supabase para cargarlos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Eliminatoria ── */}
      {tab === 'knockout' && (
        <KnockoutTab
          roundsMap={knockoutRoundsMap}
          predMap={predMap}
          onPred={onChangePred}
          onTeamClick={handleTeamClick}
          competitionCountry={compCountry}
          competitionName={compName}
        />
      )}

      {/* ── Bonus — siempre montado para que bonusRef esté disponible en handleSave ── */}
      {config?.has_bonus && (
        <div className={tab !== 'bonus' ? 'hidden' : ''}>
          <BonusTab ref={bonusRef} tournament={tournament} locked={bonusLocked} />
        </div>
      )}

      {/* ── Ranking ── */}
      {tab === 'ranking' && (
        <ProdeRankingTab
          entries={rankingEntries}
          loading={rankingLoading}
          myUserId={myUserId}
          tournamentId={id!}
          isAdmin={isOwner || isSuperAdmin}
          createdBy={tournament.created_by ?? null}
          onRemoveEntry={userId => setRankingEntries(prev => prev.filter(e => e.userId !== userId))}
        />
      )}

      {/* ── Team detail sheet / modal ── */}
      {teamDetail && (
        <TeamDetailSheet {...teamDetail} onClose={closeTeamDetail} />
      )}

    </div>
  )
}
