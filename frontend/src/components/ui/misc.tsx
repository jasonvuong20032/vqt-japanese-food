import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      sale: 'bg-sale text-white',
      muted: 'bg-muted text-muted-foreground',
      outline: 'border border-border text-foreground',
      success: 'bg-success/15 text-success',
      warning: 'bg-warning/15 text-warning',
      danger: 'bg-sale/12 text-sale',
      info: 'bg-secondary/15 text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className,
      )}
      {...props}
    />
  )
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-border', className)} />
}

interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, text, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      {icon ? <div className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-7">{icon}</div> : null}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {text ? <p className="max-w-md text-sm text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Decorative Japanese subtitle (e.g. 刺身) shown above a heading in every language. */
export function Kanji({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null
  return (
    <span lang="ja" aria-hidden className={cn('font-jp text-sm tracking-[0.3em] text-primary', className)}>
      {children}
    </span>
  )
}

export function SectionHeading({
  kanji,
  title,
  subtitle,
  action,
  className,
}: {
  kanji?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8', className)}>
      <div className="space-y-1.5">
        <Kanji>{kanji}</Kanji>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-balance md:text-3xl">{title}</h2>
        {subtitle ? <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}
