import { ArrowLeft, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useCancelOrder, useMyOrder } from '@/api/hooks'
import type { ProductCard } from '@/api/types'
import { ErrorState } from '@/components/common'
import { OrderDetails, OrderTimeline, STATUS, StatusBadge } from '@/components/order/OrderParts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/overlay'
import { Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { useCartStore } from '@/stores/cart'

export default function OrderDetailPage() {
  const { code } = useParams()
  const { t } = useTranslation()
  const f = useFormat()
  const navigate = useNavigate()
  const { data: order, isLoading, isError, refetch } = useMyOrder(code)
  const cancel = useCancelOrder()
  const add = useCartStore((s) => s.add)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reordering, setReordering] = useState(false)

  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />
  if (isError || !order) return <ErrorState onRetry={() => void refetch()} />

  /** Puts the same dishes back in the cart at today's prices (unavailable ones are skipped). */
  const reorder = async () => {
    setReordering(true)
    try {
      const products = await Promise.all(
        order.lines.map((l) => (l.slug ? api<{ card: ProductCard }>(`/api/products/${l.slug}`).then((p) => ({ card: p.card, qty: l.quantity })).catch(() => null) : null)),
      )
      const available = products.filter((p): p is { card: ProductCard; qty: number } => !!p && p.card.inStock)
      available.forEach((p) => add(p.card, p.qty))
      toast.success(t('order.reordered', { count: available.length }))
      navigate('/cart')
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('nav.orders')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-2xl font-bold">{order.code}</h2>
          <p className="text-sm text-muted-foreground">{f.dateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {order.status === STATUS.Pending ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} className="text-sale">
              {t('order.cancel')}
            </Button>
          ) : null}
          <Button size="sm" onClick={reorder} loading={reordering}>
            <RotateCw /> {t('order.reorder')}
          </Button>
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-card p-6">
        <OrderTimeline order={order} />
      </div>
      <OrderDetails order={order} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent title={t('order.cancelTitle')} description={t('order.cancelText', { code: order.code })} closeLabel={t('common.close')}>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">{t('common.back')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(order.code, {
                  onSuccess: () => {
                    toast.success(t('order.cancelled'))
                    setConfirmOpen(false)
                  },
                  onError: (error) => toast.error(errorMessage(t, error)),
                })
              }
            >
              {t('order.cancelConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
