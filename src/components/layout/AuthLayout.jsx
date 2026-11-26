import logo from '../../assets/logo.png'
import factoryImage from '../../assets/auth-factory.jpeg'
import { ShieldCheck, Lock } from 'lucide-react'

export default function AuthLayout({ children, variant }) {
  const isLogin = variant === 'login'
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <aside className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src={factoryImage} alt="Installation industrielle SmartFactory" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/65 to-blue-950/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center gap-3">
          <img src={logo} alt="" className="h-12 w-12 rounded-xl border border-white/15 bg-white/10 p-1 object-contain shadow-lg" />
          <span className="text-xl font-bold tracking-tight text-white">SmartFactory <span className="text-blue-300">Twin</span><small className="mt-0.5 block text-[9px] font-medium uppercase tracking-[.22em] text-slate-300">Maintenance prédictive</small></span>
        </div>
        <div className="relative z-10 max-w-xl pb-6 text-white">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-blue-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />Intelligence industrielle</p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">Anticipez les arrêts.<br /><span className="text-blue-200">Gardez le contrôle.</span></h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-200/90">Centralisez vos équipements, surveillez vos capteurs et planifiez la maintenance depuis un seul espace.</p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs text-slate-200"><span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Surveillance en temps réel</span><span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Maintenance prédictive</span></div>
        </div>
      </aside>

      <main className={`flex min-h-screen flex-col items-center justify-center ${isLogin ? 'px-5 py-10 sm:px-10 lg:px-14' : 'px-5 py-8 sm:px-10 lg:px-12 xl:px-16'}`}>
        <div className={`${isLogin ? 'mb-8' : 'mb-7'} flex items-center gap-3 lg:hidden`}>
          <img src={logo} alt="" className={`h-10 w-10 rounded-lg object-contain ${isLogin ? '' : 'border border-slate-200 bg-white p-1 shadow-sm'}`} />
          <span className="font-bold text-slate-900">SmartFactory <span className="text-primary-600">Twin</span></span>
        </div>
        <div className="w-full max-w-md">{children}</div>
        <div className={`${isLogin ? 'mt-8 border border-gray-100 bg-gray-50' : 'mt-5 border border-slate-200/80 bg-white/80 shadow-sm'} flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3`}>
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${isLogin ? 'bg-green-100' : 'bg-emerald-50'}`}><ShieldCheck className={`h-4 w-4 ${isLogin ? 'text-green-600' : 'text-emerald-600'}`} /></div>
          <div className="min-w-0 flex-1"><p className={`text-xs font-semibold ${isLogin ? 'text-gray-700' : 'text-slate-700'}`}>Connexion sécurisée</p><p className={`truncate text-[11px] ${isLogin ? 'text-gray-400' : 'text-slate-500'}`}>{isLogin ? 'Accès protégé à votre espace SmartFactory Twin' : 'Votre accès est protégé par authentification.'}</p></div>
          <Lock className={`h-3.5 w-3.5 flex-shrink-0 ${isLogin ? 'text-gray-300' : 'text-slate-400'}`} />
        </div>
        {!isLogin && <p className="mt-5 text-[11px] text-slate-400">© SmartFactory Twin · Maintenance prédictive</p>}
      </main>
    </div>
  )
}
