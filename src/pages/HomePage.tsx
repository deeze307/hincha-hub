// import NextMatchCard        from '../components/organisms/dashboard/NextMatchCard'
import MatchesCard          from '../components/organisms/dashboard/MatchesCard'
import MyTournamentsCard    from '../components/organisms/dashboard/MyTournamentsCard'
import RecentActivityCard   from '../components/organisms/dashboard/RecentActivityCard'
import StandingsCard        from '../components/organisms/dashboard/StandingsCard'
import RecentPredictionsCard from '../components/organisms/dashboard/RecentPredictionsCard'
import PersonalStatsCard    from '../components/organisms/dashboard/PersonalStatsCard'
import { useAuth }          from '../contexts/AuthContext'

export default function HomePage() {
  const { profile } = useAuth()
  const firstName   = profile?.full_name?.split(' ')[0] ?? profile?.username ?? 'hincha'

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <h1 className="text-text text-xl font-semibold tracking-tight">
        Hola, {firstName}!
      </h1>

      {/* Fila 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-5">
        {/* <NextMatchCard /> */}
        <MatchesCard />
        <MyTournamentsCard />
        <RecentActivityCard />
      </div>

      {/* Fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <StandingsCard />
        <RecentPredictionsCard />
        <PersonalStatsCard />
      </div>
    </div>
  )
}
