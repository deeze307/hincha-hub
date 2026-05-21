import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import ProdePage from './pages/ProdePage'
import RankingsPage from './pages/RankingsPage'
import ProfilePage from './pages/ProfilePage'
import ComingSoon from './pages/ComingSoon'
import MatchesPage from './pages/MatchesPage'
import ConfiguracionPage from './pages/ConfiguracionPage'
import NotificationsPage from './pages/NotificationsPage'
import TournamentsPage from './pages/TournamentsPage'
import TournamentFormPage from './pages/TournamentFormPage'
import RequestsPage from './pages/RequestsPage'
import TournamentProdePage from './pages/TournamentProdePage'
import TournamentRankingPage from './pages/TournamentRankingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/torneos"              element={<TournamentsPage />} />
          <Route path="/torneos/nuevo"        element={<TournamentFormPage />} />
          <Route path="/torneos/:id/editar"   element={<TournamentFormPage />} />
          <Route path="/torneos/:id/prode"    element={<TournamentProdePage />} />
          <Route path="/torneos/:id/ranking"  element={<TournamentRankingPage />} />
          <Route path="/solicitudes"          element={<RequestsPage />} />
          <Route path="/partidos"             element={<MatchesPage />} />
          <Route path="/predecir"             element={<ProdePage />} />
          <Route path="/prode"                element={<Navigate to="/predecir" replace />} />
          <Route path="/ranking"              element={<RankingsPage />} />
          <Route path="/posiciones"           element={<Navigate to="/ranking" replace />} />
          <Route path="/estadisticas"         element={<ComingSoon title="Estadísticas" />} />
          <Route path="/notificaciones"       element={<NotificationsPage />} />
          <Route path="/perfil"              element={<ProfilePage />} />
          <Route path="/configuracion"        element={<ConfiguracionPage />} />
          <Route path="/ligas"               element={<Navigate to="/torneos" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
