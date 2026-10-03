import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, LogOut, Bell,
  UserCircle, Menu,
} from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import logo from '../../assets/logo.png'

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users',     icon: Users,           label: 'Utilisateurs' },
  { to: '/admin/profile',   icon: UserCircle,      label: 'Mon profil' },
]

export default function AdminLayout({ children, pageTitle = "Vue d'ensemble" }) {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = user
    ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
    : 'AD'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`bg-navy-900 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out
                    ${collapsed ? 'w-16' : 'w-56'}`}
      >
        {/* Header sidebar : logo + nom + bouton collapse */}
        <div className="flex items-center border-b border-white/10 h-16 px-3 gap-2">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            title={collapsed ? 'Ouvrir' : 'Réduire'}
          >
            <Menu className="h-5 w-5" />
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <img src={logo} alt="logo" className="h-8 w-8 rounded-lg object-contain flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight truncate">SmartFactory</p>
                <p className="text-xs text-primary-400 font-semibold leading-tight">Twin</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg text-sm font-medium transition-all duration-150
                 ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'}
                 ${isActive
                   ? 'bg-primary-600/20 text-primary-400 border-l-2 border-primary-400'
                   : 'text-gray-400 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-white/10 space-y-0.5">
          {/* Status */}
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <p className="text-xs text-gray-500 truncate">Systèmes opérationnels</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? 'Déconnexion' : undefined}
            className={`w-full flex items-center rounded-lg text-sm font-medium
                        text-gray-400 hover:bg-white/10 hover:text-red-400 transition-all duration-150
                        disabled:opacity-50
                        ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'}`}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Navbar */}
        <header className="bg-white border-b border-gray-100 px-6 py-0 h-16 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-base font-bold text-gray-900">{pageTitle}</p>
            <p className="text-xs text-gray-400">SmartFactory Twin</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-gray-500" />
            </button>
            <NavLink to="/admin/profile" className="flex items-center gap-2.5">
              {user?.photo ? (
                <img src={user.photo} alt="avatar" className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-gray-400">{user?.role_label ?? user?.role}</p>
              </div>
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
