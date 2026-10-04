import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Wrench, Activity, Bell,
  UserCircle, Settings, LogOut, Menu,
  Building2, Layers, GitBranch, Network, ChevronDown, ScanLine,
} from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import logo from '../../assets/logo.png'
import NotificationBell from './NotificationBell'

function NavItem({ to, icon: Icon, label, collapsed, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
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

function EquipementsGroup({ collapsed }) {
  const location = useLocation()
  const isActive = location.pathname.startsWith('/equipements') || location.pathname.startsWith('/machines') || location.pathname.startsWith('/capteurs') || location.pathname.startsWith('/inspections')
  const [open, setOpen] = useState(isActive)

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        <NavItem to="/equipements" icon={Network}  label="Hiérarchie" collapsed={true} end />
        <NavItem to="/machines"    icon={Wrench}   label="Machines"   collapsed={true} />
        <NavItem to="/capteurs"    icon={Activity} label="Capteurs"   collapsed={true} end />
        <NavItem to="/inspections" icon={ScanLine} label="Inspections IA" collapsed={true} end />
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
          ${isActive ? 'text-primary-400 bg-primary-600/10' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>
        <Wrench className="h-5 w-5 flex-shrink-0" />
        <span className="flex-1 text-left">Équipements</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="ml-8 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
          {[
            { to: '/equipements',        icon: Network,   label: 'Hiérarchie', end: true },
            { to: '/equipements/usines', icon: Building2, label: 'Usines' },
            { to: '/equipements/zones',  icon: Layers,    label: 'Zones' },
            { to: '/equipements/lignes', icon: GitBranch, label: 'Lignes' },
            { to: '/machines',           icon: Wrench,    label: 'Machines' },
            { to: '/capteurs',           icon: Activity,  label: 'Capteurs', end: true },
            { to: '/inspections',        icon: ScanLine,  label: 'Inspections IA', end: true },
          ].map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
                 ${isActive ? 'text-primary-400 bg-primary-600/10' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`
              }>
              <Icon className="h-3.5 w-3.5 flex-shrink-0" /> {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
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
          <NavItem to="/operator/dashboard"     icon={LayoutDashboard} label="Dashboard"     collapsed={collapsed} end />
          <EquipementsGroup collapsed={collapsed} />
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
            <NotificationBell role={user?.role} />
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
