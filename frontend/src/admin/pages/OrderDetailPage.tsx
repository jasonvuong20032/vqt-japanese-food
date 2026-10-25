import { useState, type ReactNode } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import type { OrderView } from '@/api/types'
import { useStore } from '@/api/hooks'
import { ErrorState } from '@/components/common'
import { OrderDetails, OrderTimeline, StatusBadge } from '@/components/order/OrderParts'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAdminOrder, useUpdateOrderStatus } from '../api'
import { ConfirmDialog, Panel } from '../ui'

// Moving to these can't be undone and notifies the customer, so they ask for confirmation
const DESTRUCTIVE = new Set([2, 6])

export default function OrderDetailPage() {
  const { t } = useTranslation('admin')
  const { id } = useParams()
  const orderId = Number(id)
  const { data: order, isPending, isError, refetch } = useAdminOrder(orderId)
  const f = useFormat()

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isPending || !order) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <>
      <div className="print:hidden">
        <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t('orders.title')}
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-bold sm:text-3xl">{order.code}</h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('orders.placedOn', { date: f.dateTime(order.createdAt) })}</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> {t('orders.printInvoice')}
          </Button>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <StatusPanel order={order} />
          <Panel title={t('orders.customer')}>
            <dl className="space-y-2 text-sm">
              <Row label={t('orders.name')} value={order.fullName} />
              <Row label={t('orders.phone')} value={order.phone && <a href={`tel:${order.phone}`} className="text-primary hover:underline">{order.phone}</a>} />
              <Row label={t('orders.email')} value={order.email} />
              <Row label={t('orders.address')} value={order.address /* already the full address: street, ward, province */} />
              <Row label={t('orders.account')} value={order.userId > 0 ? t('orders.member', { id: order.userId }) : t('orders.guest')} />
            </dl>
          </Panel>
          <Panel title={t('orders.timeline')}>
            <OrderTimeline order={order} />
          </Panel>
        </div>

        <OrderDetails order={order} />
      </div>

      <Invoice order={order} />
    </>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || '—'}</dd>
    </div>
  )
}

function StatusPanel({ order }: { order: OrderView }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const update = useUpdateOrderStatus(order.id)
  const [next, setNext] = useState<number | null>(order.allowedNextStatuses[0] ?? null)
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)

  const submit = () => {
    if (next === null) return
    update.mutate(
      { status: next, note: note.trim() || null },
      {
        onSuccess: (o) => {
          toast.success(t('orders.statusChanged', { status: tc(`order.status.${o.status}`) }))
          setNote('')
          setNext(o.allowedNextStatuses[0] ?? null)
          setConfirming(false)
        },
        onError: (e) => {
          toast.error(errorMessage(tc, e))
          setConfirming(false)
        },
      },
    )
  }

  if (order.allowedNextStatuses.length === 0) {
    return (
      <Panel title={t('orders.updateStatus')}>
        <p className="text-sm text-muted-foreground">{t('orders.finalStatus')}</p>
      </Panel>
    )
  }

  return (
    <Panel title={t('orders.updateStatus')}>
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">{t('orders.moveTo')}</legend>
        <div className="flex flex-wrap gap-2">
          {order.allowedNextStatuses.map((s) => (
            <label
              key={s}
              className={cn(
                'flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                next === s
                  ? DESTRUCTIVE.has(s)
                    ? 'border-sale bg-sale text-white'
                    : 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              <input type="radio" name="next-status" className="sr-only" checked={next === s} onChange={() => setNext(s)} />
              {tc(`order.status.${s}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t('orders.note')} hint={t('orders.noteHint')} optional={t('common.optional')} className="mt-4">
        {(fieldId, describedBy) => (
          <Textarea id={fieldId} aria-describedby={describedBy} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        )}
      </Field>
      <Button
        className="mt-4 w-full"
        variant={next !== null && DESTRUCTIVE.has(next) ? 'destructive' : 'default'}
        loading={update.isPending}
        disabled={next === null}
        onClick={() => (next !== null && DESTRUCTIVE.has(next) ? setConfirming(true) : submit())}
      >
        {next !== null ? t('orders.moveToButton', { status: tc(`order.status.${next}`) }) : t('orders.updateStatus')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('orders.confirmTitle', { status: next !== null ? tc(`order.status.${next}`) : '' })}
        text={t(next === 2 ? 'orders.confirmCancel' : 'orders.confirmRefund')}
        confirmLabel={t('orders.confirm')}
        destructive
        loading={update.isPending}
        onConfirm={submit}
      />
    </Panel>
  )
}

/** Printed instead of the page (window.print). Plain black on white, whatever the theme. */
function Invoice({ order }: { order: OrderView }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const { data: store } = useStore()
  return (
    <article className="hidden bg-white text-[12px] leading-relaxed text-black print:block">
      <header className="flex justify-between border-b border-black pb-3">
        <div>
          <p className="text-lg font-bold">{store?.info.name}</p>
          <p>{store?.info.address}</p>
          <p>{store?.info.phone} · {store?.info.email}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold uppercase">{t('invoice.title')}</p>
          <p className="font-mono">{order.code}</p>
          <p>{f.dateTime(order.createdAt)}</p>
        </div>
      </header>
      <section className="mt-3">
        <p className="font-semibold">{t('invoice.billTo')}</p>
        <p>{order.fullName} · {order.phone}</p>
        <p>{order.address /* already the full address: street, ward, province */}</p>
        {order.note ? <p>{t('orders.note')}: {order.note}</p> : null}
      </section>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">{t('invoice.item')}</th>
            <th className="py-1 text-right">{t('invoice.unitPrice')}</th>
            <th className="py-1 text-right">{t('invoice.qty')}</th>
            <th className="py-1 text-right">{t('invoice.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.productId} className="border-b border-neutral-300">
              <td className="py-1">{l.productName}</td>
              <td className="py-1 text-right tabular-nums">{f.money(l.unitPrice)}</td>
              <td className="py-1 text-right tabular-nums">{l.quantity}</td>
              <td className="py-1 text-right tabular-nums">{f.money(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ml-auto w-64 space-y-0.5">
        <div className="flex justify-between"><dt>{tc('cart.subtotal')}</dt><dd className="tabular-nums">{f.money(order.subtotal)}</dd></div>
        {order.discount > 0 ? (
          <div className="flex justify-between"><dt>{tc('cart.discount')}{order.couponCode ? ` (${order.couponCode})` : ''}</dt><dd className="tabular-nums">-{f.money(order.discount)}</dd></div>
        ) : null}
        <div className="flex justify-between"><dt>{tc('cart.shipping')}</dt><dd className="tabular-nums">{f.money(order.shippingFee)}</dd></div>
        <div className="flex justify-between border-t border-black pt-1 font-bold"><dt>{tc('cart.total')}</dt><dd className="tabular-nums">{f.money(order.total)}</dd></div>
      </dl>
      <p className="mt-2">{tc(`order.payment.${order.paymentMethod}`)} · {tc(`order.paymentStatus.${order.paymentStatus}`)}</p>
      <p className="mt-6 text-center">{t('invoice.thanks')}</p>
    </article>
  )
}
