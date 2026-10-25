import type { MouseEvent } from 'react'
import { Heart, Minus, Plus, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useMe, useToggleWishlist, useWishlistIds } from '@/api/hooks'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Price({
  price,
  effectivePrice,
  className,
  size = 'md',
}: {
  price: number
  effectivePrice: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const f = useFormat()
  const onSale = effectivePrice < price
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span
        className={cn(
          'font-semibold tabular-nums',
          onSale ? 'text-sale' : 'text-foreground',
          size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-base',
        )}
      >
        {f.money(effectivePrice)}
      </span>
      {onSale ? (
        <span className={cn('text-muted-foreground tabular-nums line-through', size === 'lg' ? 'text-base' : 'text-xs')}>{f.money(price)}</span>
      ) : null}
    </div>
  )
}

export function RatingStars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-muted-foreground/40" style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-star text-star" style={{ width: size, height: size }} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  label,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  label: string
}) {
  const { t } = useTranslation()
  const button = cn(
    'grid place-items-center rounded-full transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent',
    size === 'sm' ? 'size-7' : 'size-9',
  )
  return (
    <div className={cn('inline-flex items-center rounded-full border border-border bg-card', size === 'sm' ? 'p-0.5' : 'p-1')} role="group" aria-label={label}>
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={t('product.decrease')}>
        <Minus className="size-4" />
      </button>
      <span className={cn('text-center font-semibold tabular-nums', size === 'sm' ? 'w-7 text-sm' : 'w-9')} aria-live="polite">
        {value}
      </span>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t('product.increase')}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function WishlistButton({ productId, className }: { productId: number; className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: ids } = useWishlistIds(!!me)
  const toggle = useToggleWishlist()
  const saved = !!ids?.includes(productId)

  const onClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!me) {
      toast(t('wishlist.loginRequired'), { action: { label: t('nav.login'), onClick: () => navigate('/login') } })
      return
    }
    toggle.mutate({ productId, add: !saved })
    toast.success(saved ? t('wishlist.removed') : t('wishlist.added'))
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? t('wishlist.remove') : t('wishlist.add')}
      className={cn(
        'grid size-9 place-items-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:scale-105',
        className,
      )}
    >
      <Heart className={cn('size-[18px] transition-colors', saved && 'fill-sale text-sale')} />
    </button>
  )
}
