import logo from '../../assets/logo.png'
import { ShieldCheck, Lock } from 'lucide-react'

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Panneau gauche (branding) ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-navy-900 flex-col justify-between p-10 overflow-hidden">
        {/* Image de fond industrielle */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/acceuil.png')" }}
        />
        <div className="absolute inset-0 bg-navy-900/75" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.15) 2px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Logo — plus grand et clair */}
        <div className="relative z-10 flex items-center gap-4">
          <img
            src={logo}
            alt="SmartFactory Twin"
            className="h-28 w-28 rounded-xl object-contain drop-shadow-lg"
          />
          <div>
            <p className="text-xl font-extrabold text-white leading-tight">SmartFactory</p>
            <p className="text-xl font-extrabold text-primary-400 leading-tight">Twin</p>
          </div>
        </div>

        {/* Texte bas */}
        <div className="relative z-10">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
            Industrial Intelligence Platform
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-white">
            Anticipez les défaillances.
            <br />
            Maîtrisez vos opérations.
          </h1>
          <p className="mt-4 text-base text-gray-400 max-w-sm">
            Une vision unifiée et prédictive de la santé de vos équipements industriels.
          </p>
        </div>
      </div>

      {/* ── Panneau droit (contenu) ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center items-center bg-white px-6 py-12 sm:px-12 lg:px-16">
        {/* Logo mobile */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <img src={logo} alt="SmartFactory Twin" className="h-10 w-10 rounded-xl object-contain" />
          <span className="text-base font-bold text-gray-900">
            SmartFactory <span className="text-primary-600">Twin</span>
          </span>
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>

        {/* Footer pro avec bordure */}
        <div className="mt-8 w-full max-w-md">
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 flex-shrink-0">
              <ShieldCheck className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">Connexion sécurisée SSL/TLS</p>
              <p className="text-[11px] text-gray-400 truncate">SmartFactory Twin v2.4.1 · Données chiffrées de bout en bout</p>
            </div>
            <Lock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  )
}
