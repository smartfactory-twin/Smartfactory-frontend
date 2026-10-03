import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import ProtectedRoute from './ProtectedRoute'

// Auth
import LoginPage           from '../pages/auth/LoginPage'
import ForgotPasswordPage  from '../pages/auth/ForgotPasswordPage'
import ResetPasswordPage   from '../pages/auth/ResetPasswordPage'
import ResetSuccessPage    from '../pages/auth/ResetSuccessPage'

// Admin
import AdminDashboardPage  from '../pages/admin/DashboardPage'
import AdminUsersPage      from '../pages/admin/UsersPage'
import AdminProfilePage    from '../pages/admin/ProfilePage'
import PlaceholderPage     from '../pages/PlaceholderPage'

// Technician
import TechDashboardPage   from '../pages/technician/DashboardPage'
import TechProfilePage     from '../pages/technician/ProfilePage'
import TechSection         from '../pages/technician/PlaceholderSection'

// Operator
import OpDashboardPage     from '../pages/operator/DashboardPage'
import OpProfilePage       from '../pages/operator/ProfilePage'
import OpSection           from '../pages/operator/PlaceholderSection'

function RoleRedirect() {
  const { user } = useAuthContext()
  const map = {
    ADMIN:      '/admin/dashboard',
    TECHNICIEN: '/technician/dashboard',
    OPERATEUR:  '/operator/dashboard',
  }
  return <Navigate to={map[user?.role] ?? '/login'} replace />
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Publiques ── */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/reset-success"   element={<ResetSuccessPage />} />
        <Route path="/unauthorized"    element={<PlaceholderPage title="403 — Accès refusé" />} />

        {/* ── Redirection racine ── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/"          element={<RoleRedirect />} />
          <Route path="/dashboard" element={<RoleRedirect />} />
        </Route>

        {/* ── ADMIN ── */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/users"     element={<AdminUsersPage />} />
          <Route path="/admin/profile"   element={<AdminProfilePage />} />
          <Route path="/admin/*"         element={<PlaceholderPage title="Module Admin" />} />
        </Route>

        {/* ── TECHNICIEN ── */}
        <Route element={<ProtectedRoute roles={['TECHNICIEN']} />}>
          <Route path="/technician/dashboard"
            element={<TechDashboardPage />} />
          <Route path="/technician/machines"
            element={<TechSection title="Mes machines" description="Liste des machines assignées." />} />
          <Route path="/technician/sensors"
            element={<TechSection title="Capteurs" description="Liste des capteurs de vos machines." />} />
          <Route path="/technician/measures"
            element={<TechSection title="Mesures" description="Historique des mesures capteurs." />} />
          <Route path="/technician/alerts"
            element={<TechSection title="Alertes" description="Alertes actives et historique." />} />
          <Route path="/technician/notifications"
            element={<TechSection title="Notifications" description="Toutes vos notifications." />} />
          <Route path="/technician/profile"
            element={<TechProfilePage />} />
          <Route path="/technician/settings"
            element={<TechSection title="Paramètres" />} />
        </Route>

        {/* ── OPERATEUR ── */}
        <Route element={<ProtectedRoute roles={['OPERATEUR']} />}>
          <Route path="/operator/dashboard"
            element={<OpDashboardPage />} />
          <Route path="/operator/machines"
            element={<OpSection title="Mes machines" description="Machines en surveillance." />} />
          <Route path="/operator/surveillance"
            element={<OpSection title="Surveillance" description="Mesures capteurs en temps réel." />} />
          <Route path="/operator/alerts"
            element={<OpSection title="Alertes" description="Alertes sur vos machines." />} />
          <Route path="/operator/notifications"
            element={<OpSection title="Notifications" />} />
          <Route path="/operator/profile"
            element={<OpProfilePage />} />
          <Route path="/operator/settings"
            element={<OpSection title="Paramètres" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
