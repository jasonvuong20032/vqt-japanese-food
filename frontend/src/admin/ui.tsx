import { useEffect, useState, type ReactNode } from 'react'
import { Search, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/overlay'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({ title, action, children, className, bodyClassName }: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-border bg-card text-card-foreground', className)}>
      {title || action ? (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

/**
 * KPI tile: label, value, optional change vs a named period. The change carries an arrow and a sign as
 * well as color, so it never relies on color alone; whether "up" is good is up to the caller.
 */
export function StatTile({ label, value, change, changeLabel, upIsGood = true, hint, tone, href }: {
  label: string
  value: string
  /** Relative change, e.g. 0.12 for +12%; null when there is nothing to compare with */
  change?: number | null
  changeLabel?: string
  upIsGood?: boolean
  hint?: ReactNode
  tone?: 'warning'
  href?: string
}) {
  const { i18n } = useTranslation()
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      {/* Sans + proportional figures for a standalone number */}
      <p className={cn('mt-2 font-sans text-2xl font-semibold tracking-tight', tone === 'warning' && 'text-warning')}>{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {change !== undefined && change !== null && Number.isFinite(change) ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-semibold',
              change === 0 ? 'text-muted-foreground' : (change > 0) === upIsGood ? 'text-success' : 'text-sale',
            )}
          >
            {change > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : change < 0 ? <TrendingDown className="size-3.5" aria-hidden /> : null}
            {new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(change)}
          </span>
        ) : null}
        {changeLabel && change !== undefined && change !== null ? <span className="text-muted-foreground">{changeLabel}</span> : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </>
  )
  const className = 'block rounded-2xl border border-border bg-card p-5'
  return href ? (
    <Link to={href} className={cn(className, 'transition-colors hover:border-primary/50')}>{body}</Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** Change from `previous` to `current` as a fraction; null when there is no baseline. */
export function relativeChange(current: number, previous: number) {
  return previous > 0 ? (current - previous) / previous : null
}

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function SearchField({ value, onChange, placeholder, className }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-input bg-card pr-4 pl-10 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
      />
    </label>
  )
}

export function ConfirmDialog({ open, onOpenChange, title, text, confirmLabel, destructive, loading, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  text?: ReactNode
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  const { t } = useTranslation('admin')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} closeLabel={t('common.cancel')} className="max-w-md">
        {text ? <div className="text-sm text-muted-foreground">{text}</div> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant={destructive ? 'destructive' : 'default'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Segmented control used for status tabs and small filters. */
export function Segmented<T extends string | number>({ value, onChange, options, label }: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="scrollbar-none relative flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
            o.value === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Field -> error code from a "validation_failed" response, for forms that keep their own state. */
export function serverFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'validation_failed' || !error.details) return {}
  return Object.fromEntries(
    Object.entries(error.details).map(([field, code]) => [field.charAt(0).toLowerCase() + field.slice(1), String(Array.isArray(code) ? code[0] : code)]),
  )
}
