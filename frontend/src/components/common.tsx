import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronRight as Sep, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Per-page <title>/<meta>; React 19 hoists these into <head>. */
export function PageMeta({ title, description, image }: { title?: string; description?: string | null; image?: string | null }) {
  const { t } = useTranslation()
  const full = title ? `${title} | ${t('brand.name')}` : t('meta.defaultTitle')
  const desc = description || t('meta.defaultDescription')
  return (
    <>
      <title>{full}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={desc} />
      {image ? <meta property="og:image" content={new URL(image, window.location.origin).toString()} /> : null}
    </>
  )
}

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('common.breadcrumb')} className={cn('text-sm text-muted-foreground', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/" className="hover:text-foreground">
            {t('nav.home')}
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <Sep className="size-3.5 opacity-60" aria-hidden />
            {item.to && i < items.length - 1 ? (
              <Link to={item.to} className="hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground" aria-current={i === items.length - 1 ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  const pages: (number | 'gap')[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages[pages.length - 1] !== 'gap') pages.push('gap')
  }

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label={t('common.pagination')}>
      <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('common.previous')}>
        <ChevronLeft />
      </Button>
      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'size-9 rounded-full text-sm font-medium transition-colors',
              p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {p}
          </button>
        ),
      )}
      <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label={t('common.next')}>
        <ChevronRight />
      </Button>
    </nav>
  )
}

export function ErrorState({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col items-center gap-3 py-16 text-center', className)}>
      <CircleAlert className="size-10 text-sale" />
      <p className="font-medium">{t('errors.loadFailed')}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}

/** Centered page container with consistent gutters. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4', className)}>{children}</div>
}
