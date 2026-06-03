interface BadgeProps {
  children: React.ReactNode
  variant?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange'
  size?: 'sm' | 'md'
  dot?: boolean
}

const variantMap: Record<string, string> = {
  blue:   'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  green:  'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  red:    'bg-red-500/15 text-red-400 ring-red-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30',
  purple: 'bg-purple-500/15 text-purple-400 ring-purple-500/30',
  gray:   'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  orange: 'bg-orange-500/15 text-orange-400 ring-orange-500/30',
}

const dotMap: Record<string, string> = {
  blue: 'bg-blue-400', green: 'bg-emerald-400', red: 'bg-red-400',
  yellow: 'bg-yellow-400', purple: 'bg-purple-400', gray: 'bg-zinc-400',
  orange: 'bg-orange-400',
}

export default function Badge({ children, variant = 'gray', size = 'sm', dot }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ring-1 ring-inset ${sizeClass} ${variantMap[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotMap[variant]}`} />}
      {children}
    </span>
  )
}
