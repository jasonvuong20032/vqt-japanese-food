import { Check, ChefHat, CircleX, ClipboardCheck, House, PackageCheck, RotateCcw, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { OrderView } from '@/api/types'
import { Badge } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'

export const STATUS = { Pending: 0, Confirmed: 1, Cancelled: 2, Preparing: 3, Shipping: 4, Delivered: 5, Refunded: 6 } as const

const STATUS_VARIANT: Record<number, 'warning' | 'info' | 'danger' | 'success' | 'muted'> = {
  0: 'warning',
  1: 'info',
  2: 'danger',
  3: 'info',
  4: 'info',
  5: 'success',
  6: 'muted',
}

export function StatusBadge({ status }: { status: number }) {
  const { t } = useTranslation()
  return <Badge variant={STATUS_VARIANT[status] ?? 'muted'}>{t(`order.status.${status}`)}</Badge>
}

const FLOW = [
  { status: STATUS.Pending, icon: ClipboardCheck },
  { status: STATUS.Confirmed, icon: Check },
  { status: STATUS.Preparing, icon: ChefHat },
  { status: STATUS.Shipping, icon: Truck },
  { status: STATUS.Delivered, icon: House },
]

/** Pending → Confirmed → Preparing → Shipping → Delivered, with timestamps from the order history. */
export function OrderTimeline({ order }: { order: OrderView }) {
  const { t } = useTranslation()
  const f = useFormat()
  const reachedAt = (status: number) => order.history.find((h) => h.toStatus === status)?.at

  if (order.status === STATUS.Cancelled || order.status === STATUS.Refunded) {
    const event = order.history.find((h) => h.toStatus === order.status)
    const Icon = order.status === STATUS.Cancelled ? CircleX : RotateCcw
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-sale/30 bg-sale/8 p-4">
        <Icon className="mt-0.5 size-5 text-sale" />
        <div>
          <p className="font-semibold">{t(`order.status.${order.status}`)}</p>
          {event ? <p className="text-sm text-muted-foreground">{f.dateTime(event.at)}{event.note ? ` — ${event.note}` : ''}</p> : null}
        </div>
      </div>
    )
  }

  const currentIndex = Math.max(0, FLOW.findIndex((s) => s.status === order.status))
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t('order.timeline')}>
      {FLOW.map((step, i) => {
        const done = i <= currentIndex
        const at = step.status === STATUS.Pending ? order.createdAt : reachedAt(step.status)
        const Icon = step.icon
        return (
          <li key={step.status} className="relative flex flex-col items-center text-center">
            {i > 0 ? (
              <span className={cn('absolute top-5 right-1/2 h-0.5 w-full -translate-y-1/2', i <= currentIndex ? 'bg-primary' : 'bg-border')} aria-hidden />
            ) : null}
            <span
              className={cn(
                'relative grid size-10 place-items-center rounded-full border-2 transition-colors',
                done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                i === currentIndex && 'ring-4 ring-primary/20',
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            <span className={cn('mt-2 text-xs font-medium sm:text-sm', !done && 'text-muted-foreground')}>{t(`order.status.${step.status}`)}</span>
            {done && at ? <span className="hidden text-[11px] text-muted-foreground sm:block">{f.dateTime(at)}</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

export function OrderDetails({ order }: { order: OrderView }) {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="mb-2 font-display text-lg font-semibold">{t('order.items', { count: order.quantity })}</h2>
        <ul className="divide-y divide-border">
          {order.lines.map((l) => (
            <li key={l.productId} className="flex items-center gap-3 py-3">
              <span className="block size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {l.imageUrl ? <img src={l.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                {l.slug ? (
                  <Link to={`/p/${l.slug}`} className="font-medium hover:text-primary">
                    {l.productName}
                  </Link>
                ) : (
                  <span className="font-medium">{l.productName}</span>
                )}
                <p className="text-sm text-muted-foreground tabular-nums">
                  {f.money(l.unitPrice)} × {l.quantity}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{f.money(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="space-y-4">
        <section className="rounded-3xl border border-border bg-card p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('cart.subtotal')}</dt><dd className="tabular-nums">{f.money(order.subtotal)}</dd></div>
            {order.discount > 0 ? (
              <div className="flex justify-between text-success"><dt>{t('cart.discount')}{order.couponCode ? ` (${order.couponCode})` : ''}</dt><dd className="tabular-nums">-{f.money(order.discount)}</dd></div>
            ) : null}
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('cart.shipping')}</dt><dd className="tabular-nums">{order.shippingFee === 0 ? t('cart.free') : f.money(order.shippingFee)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>{t('cart.total')}</dt><dd className="tabular-nums">{f.money(order.total)}</dd></div>
          </dl>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <PackageCheck className="size-4" /> {t(`order.payment.${order.paymentMethod}`)} · {t(`order.paymentStatus.${order.paymentStatus}`)}
          </p>
        </section>
        <section className="rounded-3xl border border-border bg-card p-5 text-sm">
          <h3 className="mb-2 font-semibold">{t('order.shipTo')}</h3>
          <p>{order.fullName}</p>
          <p className="text-muted-foreground">{order.phone}</p>
          <p className="text-muted-foreground">{order.address}</p>
          {order.note ? <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-muted-foreground">“{order.note}”</p> : null}
        </section>
      </aside>
    </div>
  )
}
