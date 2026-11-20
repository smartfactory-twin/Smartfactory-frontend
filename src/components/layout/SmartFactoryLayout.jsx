import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, Bell, Building2, ChevronDown, Cpu, FileText, GitBranch, LayoutDashboard,
  LogOut, Menu, Moon, Network, ScanLine, Sun, UserCircle, Users,
  Wrench, Layers, Mic,
} from 'lucide-react'
import { useAuthContext } from '../../context/AuthContext'
import NotificationBell from './NotificationBell'
import { getAlertCounter } from '../../services/alertService'
import logo from '../../assets/logo.png'
import './smartfactory-shell.css'

const equipmentLinks = [
  { to: '/equipements', label: 'Hiérarchie', icon: Network, end: true },
  { to: '/equipements/usines', label: 'Usines', icon: Building2 },
  { to: '/equipements/zones', label: 'Zones', icon: Layers },
  { to: '/equipements/lignes', label: 'Lignes', icon: GitBranch },
]

const navigation = {
  ADMIN: [
    { heading: 'Supervision' },
    { to: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { heading: 'Équipements' },
    { to: '/machines', label: 'Équipements', icon: Wrench },
    { to: '/capteurs', label: 'Capteurs', icon: Activity },
    { group: 'Structure', icon: Cpu, links: equipmentLinks },
    { heading: 'Intelligence' },
    { to: '/inspections', label: 'Inspection visuelle', icon: ScanLine },
    { to: '/predictions-ia', label: 'Prédictions IA', icon: Cpu },
    { heading: 'Opérations' },
    { to: '/maintenance', label: 'Maintenance', icon: Wrench },
    { to: '/alertes', label: 'Alertes', icon: Bell },
    { to: '/rapports', label: 'Rapports et exports', icon: FileText },
    { to: '/assistant-vocal', label: 'Assistant vocal', icon: Mic },
    { heading: 'Système' },
    { to: '/admin/users', label: 'Utilisateurs', icon: Users },
  ],
  TECHNICIEN: [
    { heading: 'Supervision' },
    { to: '/technician/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { heading: 'Équipements' },
    { to: '/machines', label: 'Équipements', icon: Wrench },
    { to: '/capteurs', label: 'Capteurs', icon: Activity },
    { group: 'Structure', icon: Cpu, links: equipmentLinks },
    { heading: 'Intelligence' },
    { to: '/inspections', label: 'Inspection visuelle', icon: ScanLine },
    { to: '/predictions-ia', label: 'Prédictions IA', icon: Cpu },
    { heading: 'Opérations' },
    { to: '/maintenance', label: 'Maintenance', icon: Wrench },
    { to: '/technician/alerts', label: 'Alertes', icon: Bell },
    { to: '/rapports', label: 'Rapports et exports', icon: FileText },
  ],
  OPERATEUR: [
    { heading: 'Supervision' },
    { to: '/operator/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/operator/surveillance', label: 'Surveillance', icon: Activity },
    { heading: 'Équipements' },
    { to: '/capteurs', label: 'Capteurs', icon: Activity },
    { heading: 'Opérations' },
    { to: '/operator/alerts', label: 'Alertes', icon: Bell },
    { heading: 'Assistant' },
    { to: '/assistant-vocal', label: 'Assistant vocal', icon: Mic },
  ],
}

const profileRoute = {
  ADMIN: '/admin/profile',
  TECHNICIEN: '/technician/profile',
  OPERATEUR: '/operator/profile',
}

function SidebarLink({ item, collapsed, onNavigate, alertCount = 0 }) {
  const Icon = item.icon
  const badgeCount = item.label === 'Alertes' ? alertCount : 0
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) => `sf-nav-link${isActive ? ' is-active' : ''}${collapsed ? ' is-collapsed' : ''}`}
    >
      <Icon aria-hidden="true" />
      {!collapsed && <span>{item.label}</span>}
      {badgeCount > 0 && <span className="sf-nav-count" aria-label={`${badgeCount} ${item.label.toLowerCase()}`}>{badgeCount > 99 ? '99+' : badgeCount}</span>}
      {collapsed && badgeCount > 0 && <span className="sf-nav-count sf-nav-count-collapsed" aria-label={`${badgeCount} ${item.label.toLowerCase()}`}>{badgeCount > 99 ? '99+' : badgeCount}</span>}
    </NavLink>
  )
}

function NavigationGroup({ item, collapsed, onNavigate }) {
  const location = useLocation()
  const active = item.links.some((link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`))
  const [open, setOpen] = useState(active)
  const Icon = item.icon

  useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  if (collapsed) {
    return item.links.map((link) => <SidebarLink key={link.to} item={link} collapsed onNavigate={onNavigate} />)
  }

  return (
    <div className="sf-nav-group">
      <button className={`sf-nav-group-button${active ? ' is-active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Icon aria-hidden="true" /><span>{item.group}</span><ChevronDown className={open ? '' : 'is-closed'} aria-hidden="true" />
      </button>
      {open && <div className="sf-nav-children">{item.links.map((link) => <SidebarLink key={link.to} item={link} onNavigate={onNavigate} />)}</div>}
    </div>
  )
}

export default function SmartFactoryLayout({ children, pageTitle, role }) {
  const { user, logout } = useAuthContext()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const [themePreference, setThemePreference] = useState(() => localStorage.getItem('sf-theme-preference') || (localStorage.getItem('sf-theme') === 'dark' ? 'dark' : null))
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = themePreference ? themePreference === 'dark' : systemDark
  const items = navigation[role] ?? navigation.OPERATEUR
  const profile = profileRoute[role] ?? profileRoute.OPERATEUR
  const initials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase() || 'SF'

  useEffect(() => {
    if (themePreference === 'dark' || themePreference === 'light') {
      document.documentElement.dataset.theme = themePreference
      localStorage.setItem('sf-theme-preference', themePreference)
      localStorage.removeItem('sf-theme')
    } else {
      delete document.documentElement.dataset.theme
      localStorage.removeItem('sf-theme-preference')
      localStorage.removeItem('sf-theme')
    }
  }, [themePreference])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (event) => setSystemDark(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    let active = true
    const refreshCounters = async () => {
      const alertsResult = await Promise.allSettled([getAlertCounter()])
      if (!active) return
      if (alertsResult[0].status === 'fulfilled') setAlertCount(alertsResult[0].value?.actives ?? 0)
    }
    refreshCounters()
    const interval = window.setInterval(refreshCounters, 30_000)
    window.addEventListener('focus', refreshCounters)
    window.addEventListener('alerts-updated', refreshCounters)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshCounters)
      window.removeEventListener('alerts-updated', refreshCounters)
    }
  }, [location.pathname])

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  const mobileLinks = items.filter((item) => item.to && !item.to.includes('notifications') && !item.to.includes('profile')).slice(0, 4)

  return (
    <div className={`sf-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="sf-mobile-scrim" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sf-sidebar${mobileOpen ? ' mobile-open' : ''}`} aria-label="Navigation principale">
        <div className="sf-brand-row">
          <button className="sf-icon-button sf-collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Développer la navigation' : 'Réduire la navigation'}>
            <Menu aria-hidden="true" />
          </button>
          {!collapsed && <NavLink to={role === 'ADMIN' ? '/admin/dashboard' : role === 'TECHNICIEN' ? '/technician/dashboard' : '/operator/dashboard'} className="sf-brand">
            <img src={logo} alt="" /><span><b>SmartFactory Twin</b><small>MAINTENANCE PRÉDICTIVE</small></span>
          </NavLink>}
        </div>
        <nav className="sf-nav-list">
          {items.map((item, index) => item.heading
            ? (!collapsed && <div key={`heading-${index}`} className="sf-nav-heading">{item.heading}</div>)
            : item.group
              ? <NavigationGroup key={item.group} item={item} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
              : <SidebarLink key={item.to} item={item} collapsed={collapsed} alertCount={alertCount} onNavigate={() => setMobileOpen(false)} />)}
        </nav>
        <div className="sf-sidebar-footer">
          {!collapsed && <NavLink to={profile} className="sf-user-card">
            {user?.photo ? <img src={user.photo} alt="" /> : <span className="sf-avatar">{initials}</span>}
            <span><b>{user?.prenom} {user?.nom}</b><small>{user?.role_label ?? user?.role}</small></span>
          </NavLink>}
          <button className="sf-nav-link sf-logout" onClick={handleLogout} disabled={loggingOut} title={collapsed ? 'Se déconnecter' : undefined}>
            <LogOut aria-hidden="true" />{!collapsed && <span>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>}
          </button>
        </div>
      </aside>

      <div className="sf-main">
        <header className="sf-topbar">
          <button className="sf-icon-button sf-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu /></button>
          <div className="sf-page-heading"><h1>{pageTitle}</h1><span>SmartFactory Twin · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
          <span className="sf-topbar-spacer" />
          <span className="sf-live-badge"><i /> Système actif</span>
          <button className="sf-icon-button sf-theme-toggle" onClick={() => setThemePreference(dark ? 'light' : 'dark')} aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'} title={dark ? 'Thème clair' : 'Thème sombre'}>{dark ? <Sun /> : <Moon />}</button>
          <NotificationBell role={role} />
          <NavLink to={profile} className="sf-top-user" aria-label="Ouvrir mon profil">
            {user?.photo ? <img src={user.photo} alt="" /> : <span className="sf-avatar">{initials}</span>}
            <span><b>{user?.prenom} {user?.nom}</b><small>{user?.role_label ?? user?.role}</small></span>
          </NavLink>
        </header>
        <main className={`sf-content${location.pathname.startsWith('/equipements') || location.pathname.startsWith('/machines') || location.pathname.startsWith('/capteurs') ? ' sf-equipment-content' : ''}`}>{children}</main>
      </div>

      <nav className="sf-mobile-tabbar" aria-label="Navigation rapide">
        {mobileLinks.map((item) => <SidebarLink key={item.to} item={item} alertCount={alertCount} onNavigate={() => setMobileOpen(false)} />)}
        <button className="sf-nav-link" onClick={() => setMobileOpen(true)}><Menu aria-hidden="true" /><span>Plus</span></button>
      </nav>
    </div>
  )
}
