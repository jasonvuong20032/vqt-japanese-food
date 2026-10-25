import { CircleAlert, Tag, Trash2, Truck, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { CartQuote, QuoteLine } from '@/api/types'
import { QuantityStepper } from '@/components/product/parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCartStore, type CartItem } from '@/stores/cart'
import { useUiStore } from '@/stores/ui'

export function FreeShippingProgress({ quote }: { quote: CartQuote }) {
  const { t } = useTranslation()
  const f = useFormat()
  if (quote.freeShippingThreshold <= 0) return null
  const afterDiscount = quote.subtotal - quote.discount
  const pct = Math.min(100, Math.round((afterDiscount / quote.freeShippingThreshold) * 100))
  const unlocked = quote.amountToFreeShipping <= 0
  return (
    <div className="rounded-2xl bg-muted px-4 py-3">
      <p className="mb-2 flex items-center gap-2 text-sm">
        <Truck className={cn('size-4', unlocked ? 'text-success' : 'text-primary')} />
        {unlocked ? (
          <span className="font-medium text-success">{t('cart.freeShippingUnlocked')}</span>
        ) : (
          <span>{t('cart.freeShippingProgress', { amount: f.money(quote.amountToFreeShipping) })}</span>
        )}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full transition-all duration-500', unlocked ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function problemText(t: (k: string, o?: Record<string, unknown>) => string, line: QuoteLine) {
  if (line.problem === 'unavailable') return t('cart.problem.unavailable')
  if (line.problem === 'out_of_stock') return t('cart.problem.outOfStock')
  if (line.problem === 'insufficient_stock') return t('cart.problem.insufficient', { count: line.availableStock })
  return null
}

/** One cart row: live server data when available, otherwise the snapshot saved in the browser. */
export function CartLineRow({ item, line, compact }: { item: CartItem; line?: QuoteLine; compact?: boolean }) {
  const { t } = useTranslation()
  const f = useFormat()
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const setCartOpen = useUiStore((s) => s.setCartOpen)
  const name = line?.name || item.name
  const unit = line?.unitPrice ?? item.price
  const problem = line ? problemText(t, line) : null

  return (
    <li className="flex gap-3 py-4">
      <Link to={`/p/${item.slug}`} onClick={() => setCartOpen(false)} className={cn('block shrink-0 overflow-hidden rounded-xl bg-muted', compact ? 'size-20' : 'size-24')}>
        {item.imageUrl ? <img src={line?.imageUrl ?? item.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/p/${item.slug}`} onClick={() => setCartOpen(false)} className="font-medium leading-snug hover:text-primary">
            {name}
          </Link>
          <button onClick={() => remove(item.productId)} className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-sale" aria-label={t('cart.remove', { name })}>
            {compact ? <X className="size-4" /> : <Trash2 className="size-4" />}
          </button>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {f.money(unit)}
          {line && line.unitPrice < line.price ? <span className="ml-1.5 text-xs line-through">{f.money(line.price)}</span> : null}
        </p>
        {problem ? (
          <p className="flex items-center gap-1 text-xs font-medium text-sale">
            <CircleAlert className="size-3.5" /> {problem}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2">
          <QuantityStepper
            size="sm"
            value={item.quantity}
            max={line && line.availableStock > 0 ? Math.min(99, line.availableStock) : 99}
            onChange={(q) => setQuantity(item.productId, q)}
            label={t('product.quantity')}
          />
          <span className="font-semibold tabular-nums">{f.money(line?.lineTotal ?? unit * item.quantity)}</span>
        </div>
      </div>
    </li>
  )
}

export function CouponForm({ quote }: { quote?: CartQuote }) {
  const { t } = useTranslation()
  const couponCode = useCartStore((s) => s.couponCode)
  const setCoupon = useCartStore((s) => s.setCoupon)
  const [value, setValue] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) setCoupon(value.trim().toUpperCase())
  }

  if (couponCode && quote?.couponCode) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-dashed border-success/60 bg-success/10 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-success">
          <Tag className="size-4" /> {t('cart.couponApplied', { code: quote.couponCode })}
        </span>
        <button onClick={() => setCoupon(null)} className="text-xs text-muted-foreground hover:text-foreground">
          {t('cart.removeCoupon')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('cart.couponPlaceholder')} aria-label={t('cart.coupon')} className="uppercase placeholder:normal-case" />
        <Button type="submit" variant="outline" disabled={!value.trim()}>
          {t('cart.apply')}
        </Button>
      </div>
      {couponCode && quote?.couponError ? (
        <p className="text-xs font-medium text-sale">{t(`errors.${quote.couponError}`, { defaultValue: t('errors.coupon_invalid') })}</p>
      ) : null}
    </form>
  )
}

export function Totals({ quote, className }: { quote: CartQuote; className?: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{t('cart.subtotal')}</dt>
        <dd className="tabular-nums">{f.money(quote.subtotal)}</dd>
      </div>
      {quote.discount > 0 ? (
        <div className="flex justify-between text-success">
          <dt>{t('cart.discount')}</dt>
          <dd className="tabular-nums">-{f.money(quote.discount)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{t('cart.shipping')}</dt>
        <dd className="tabular-nums">{quote.shippingFee === 0 ? <span className="font-medium text-success">{t('cart.free')}</span> : f.money(quote.shippingFee)}</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <dt className="font-semibold">{t('cart.total')}</dt>
        <dd className="text-xl font-bold tabular-nums">{f.money(quote.total)}</dd>
      </div>
    </dl>
  )
}
