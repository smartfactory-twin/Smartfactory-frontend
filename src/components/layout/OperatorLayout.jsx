import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Wrench, Activity, Bell,
  UserCircle, Settings, LogOut, Menu,
} from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import logo from '../../assets/logo.png'

function NavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
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
  )
}

export default function OperatorLayout({ children, pageTitle = 'Dashboard' }) {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className={`bg-navy-900 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-56'}`}>

        {/* Header */}
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

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <NavItem to="/operator/dashboard"     icon={LayoutDashboard} label="Dashboard"     collapsed={collapsed} />
          <NavItem to="/operator/machines"      icon={Wrench}          label="Mes machines"  collapsed={collapsed} />
          <NavItem to="/operator/surveillance"  icon={Activity}        label="Surveillance"  collapsed={collapsed} />
          <NavItem to="/operator/alerts"        icon={Bell}            label="Alertes"       collapsed={collapsed} />
          <NavItem to="/operator/notifications" icon={Bell}            label="Notifications" collapsed={collapsed} />
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-white/10 space-y-0.5">
          <NavItem to="/operator/profile"  icon={UserCircle} label="Mon profil"  collapsed={collapsed} />
          <NavItem to="/operator/settings" icon={Settings}   label="Paramètres"  collapsed={collapsed} />
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? 'Déconnexion' : undefined}
            className={`w-full flex items-center rounded-lg text-sm font-medium
                        text-gray-400 hover:bg-white/10 hover:text-red-400 transition-all duration-150 disabled:opacity-50
                        ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'}`}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-0 h-16 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-base font-bold text-gray-900">{pageTitle}</p>
            <p className="text-xs text-gray-400">SmartFactory Twin</p>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/operator/notifications" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-gray-500" />
            </NavLink>
            <NavLink to="/operator/profile" className="flex items-center gap-2.5">
              {user?.photo ? (
                <img src={user.photo} alt="avatar" className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-gray-400">Opérateur</p>
              </div>
            </NavLink>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
