import Spinner from './Spinner'

const variants = {
  primary:   'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 focus:ring-gray-300',
  danger:    'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-600 focus:ring-gray-300',
}

const sizes = {
  sm: 'py-1.5 px-3 text-sm',
  md: 'py-2.5 px-4 text-sm',
  lg: 'py-3 px-6 text-base',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  loading = false, disabled = false, className = '', type = 'button', onClick,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg
                  transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner size="sm" className="border-t-white border-white/30" />}
      {children}
    </button>
  )
}
