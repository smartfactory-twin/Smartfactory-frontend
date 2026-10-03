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

// Machines (Module 2)
import MachinesListPage    from '../pages/machines/MachinesListPage'
import MachineDetailPage   from '../pages/machines/MachineDetailPage'
import MachineFormPage     from '../pages/machines/MachineFormPage'

// Équipements — hiérarchie UC-04
import HierarchiePage      from '../pages/equipements/HierarchiePage'
import UsinesPage          from '../pages/equipements/UsinesPage'
import ZonesPage           from '../pages/equipements/ZonesPage'
import LignesPage          from '../pages/equipements/LignesPage'

// Module 3 — Capteurs & Données IoT
import CapteursPage        from '../pages/equipements/CapteursPage'
import CapteurFormPage     from '../pages/equipements/CapteurFormPage'
import CapteurDetailPage   from '../pages/equipements/CapteurDetailPage'
import SensorsImportPage   from '../pages/equipements/SensorsImportPage'
import ReadingsImportPage  from '../pages/equipements/ReadingsImportPage'

// Module 4 — Inspection visuelle par IA
import InspectionsPage     from '../pages/inspections/InspectionsPage'

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

        {/* ── Équipements — hiérarchie (tous rôles authentifiés) ── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/equipements"              element={<HierarchiePage />} />
          <Route path="/equipements/usines"       element={<UsinesPage />} />
          <Route path="/equipements/zones"        element={<ZonesPage />} />
          <Route path="/equipements/lignes"       element={<LignesPage />} />
        </Route>

        {/* ── Module 3 — Capteurs & Données IoT (tous rôles authentifiés) ── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/capteurs"                 element={<CapteursPage />} />
          <Route path="/capteurs/import-sensors"  element={<SensorsImportPage />} />
          <Route path="/capteurs/import-readings" element={<ReadingsImportPage />} />
          <Route path="/capteurs/nouveau"         element={<CapteurFormPage />} />
          <Route path="/capteurs/:id"             element={<CapteurDetailPage />} />
        </Route>

        {/* ── Capteurs création/édition (ADMIN uniquement) ── */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/capteurs/:id/modifier"    element={<CapteurFormPage />} />
        </Route>

        {/* ── Machines (tous rôles authentifiés) ── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/machines"     element={<MachinesListPage />} />
          <Route path="/machines/:id" element={<MachineDetailPage />} />
        </Route>

        {/* ── Module 4 — Inspection visuelle par IA (tous rôles authentifiés) ── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/inspections" element={<InspectionsPage />} />
        </Route>

        {/* ── Machines création/édition (ADMIN + TECHNICIEN) ── */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'TECHNICIEN']} />}>
          <Route path="/machines/new"       element={<MachineFormPage />} />
          <Route path="/machines/:id/edit"  element={<MachineFormPage />} />
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
