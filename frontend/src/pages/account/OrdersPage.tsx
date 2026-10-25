import { ChevronRight, Package } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMyOrders } from '@/api/hooks'
import { ErrorState, Pagination } from '@/components/common'
import { StatusBadge } from '@/components/order/OrderParts'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'

export default function OrdersPage() {
  const { t } = useTranslation()
  const f = useFormat()
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, refetch } = useMyOrders(page)

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}</div>
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (!data?.items.length) {
    return (
      <EmptyState
        icon={<Package />}
        title={t('order.none')}
        text={t('order.noneHint')}
        action={<Button asChild><Link to="/menu">{t('cart.browseMenu')}</Link></Button>}
        className="rounded-3xl border border-border bg-card"
      />
    )
  }

  return (
    <div>
      <ul className="space-y-3">
        {data.items.map((o) => (
          <li key={o.id}>
            <Link to={`/account/orders/${o.code}`} className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-soft">
              <span className="block size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                {o.firstImageUrl ? <img src={o.firstImageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{o.code}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {o.firstProductName}
                  {o.quantity > 1 ? ` ${t('order.andMore', { count: o.quantity - 1 })}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">{f.dateTime(o.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{f.money(o.total)}</p>
                <ChevronRight className="ml-auto size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </div>
  )
}
