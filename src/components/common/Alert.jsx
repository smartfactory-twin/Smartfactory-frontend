import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useState } from 'react'

const config = {
  success: { icon: CheckCircle,    bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-800', icon_color: 'text-green-500' },
  error:   { icon: AlertCircle,    bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-800',   icon_color: 'text-red-500' },
  warning: { icon: AlertTriangle,  bg: 'bg-yellow-50', border: 'border-yellow-200',text: 'text-yellow-800',icon_color: 'text-yellow-500' },
  info:    { icon: Info,           bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',  icon_color: 'text-blue-500' },
}

export default function Alert({ type = 'info', message, dismissible = false, className = '' }) {
  const [visible, setVisible] = useState(true)
  if (!visible || !message) return null
  const { icon: Icon, bg, border, text, icon_color } = config[type]
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bg} ${border} ${className}`} role="alert">
      <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${icon_color}`} />
      <p className={`text-sm flex-1 ${text}`}>{message}</p>
      {dismissible && (
        <button onClick={() => setVisible(false)} className={`${text} hover:opacity-70`} aria-label="Fermer">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
