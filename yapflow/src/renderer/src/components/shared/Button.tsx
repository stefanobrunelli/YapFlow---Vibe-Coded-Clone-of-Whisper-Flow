import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'primary' | 'danger'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'ghost', size = 'md', className = '', children, ...props }, ref) => {
    const base = 'no-drag inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
    const sizes = {
      sm: 'px-2.5 py-1 text-[11px]',
      md: 'px-3 py-1.5 text-xs'
    }
    const variants = {
      ghost: 'text-white/70 hover:text-white hover:bg-white/10 active:bg-white/15',
      primary: 'bg-indigo-500/80 text-white hover:bg-indigo-500 active:bg-indigo-600',
      danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/15 active:bg-red-500/20'
    }

    return (
      <button
        ref={ref}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
