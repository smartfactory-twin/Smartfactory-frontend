import logo from '../../assets/logo.png'
import factoryImage from '../../assets/auth-factory.jpeg'
import { ShieldCheck, Lock } from 'lucide-react'

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <aside className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img src={factoryImage} alt="Installation industrielle SmartFactory" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/45 to-blue-950/35" />
        <div className="relative z-10 flex items-center gap-3">
          <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain" />
          <span className="text-xl font-bold text-white">SmartFactory <span className="text-blue-300">Twin</span></span>
        </div>
        <div className="relative z-10 max-w-xl pb-6 text-white">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Industrial Intelligence Platform</p>
          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">Anticipez les défaillances.<br />Maîtrisez vos opérations.</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-200">Une vision unifiée de vos équipements, capteurs et opérations de maintenance.</p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
          <span className="font-bold text-slate-900">SmartFactory <span className="text-primary-600">Twin</span></span>
        </div>
        <div className="w-full max-w-md">{children}</div>
        <div className="mt-8 flex w-full max-w-md items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-100"><ShieldCheck className="h-4 w-4 text-green-600" /></div>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-gray-700">Connexion sécurisée</p><p className="truncate text-[11px] text-gray-400">Accès protégé à votre espace SmartFactory Twin</p></div>
          <Lock className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
        </div>
      </main>
    </div>
  )
}
