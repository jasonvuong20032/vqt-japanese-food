import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ErrorState, Pagination } from '@/components/common'
import { StatusBadge } from '@/components/order/OrderParts'
import { Input } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAdminOrders, useOrderCounts } from '../api'
import { PageHeader, SearchField, Segmented, useDebounced } from '../ui'

const TABS = [null, 0, 1, 3, 4, 5, 2, 6] as const

export default function OrdersPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') === null ? null : Number(params.get('status'))
  const page = Number(params.get('page') ?? 1)
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search.trim())

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === '') next.delete(k)
          else next.set(k, v)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )

  const query = { status: status ?? undefined, search: q || undefined, from: from || undefined, to: to || undefined, page, pageSize: 20 }
  const { data, isPending, isError, isFetching, refetch } = useAdminOrders(query)
  const { data: counts } = useOrderCounts()
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null

  return (
    <>
      <PageHeader title={t('orders.title')} description={t('orders.subtitle')} />

      <Segmented
        label={t('orders.statusFilter')}
        value={status ?? -1}
        onChange={(v) => update({ status: v === -1 ? null : String(v) })}
        options={TABS.map((s) => {
          const count = s === null ? total : counts?.[String(s)] ?? 0
          return {
            value: s ?? -1,
            label: (
              <>
                {s === null ? t('orders.all') : tc(`order.status.${s}`)}
                {count !== null ? <span className="text-xs opacity-70 tabular-nums">{count}</span> : null}
              </>
            ),
          }
        })}
      />

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <SearchField
          className="w-full sm:w-80"
          value={search}
          onChange={(v) => {
            setSearch(v)
            update({ q: v.trim() || null })
          }}
          placeholder={t('orders.searchPlaceholder')}
        />
        <label className="text-xs text-muted-foreground">
          {t('orders.from')}
          <Input type="date" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} className="mt-1 h-11 w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          {t('orders.to')}
          <Input type="date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} className="mt-1 h-11 w-40" />
        </label>
      </div>

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className={cn('relative mt-4 overflow-x-auto rounded-2xl border border-border bg-card transition-opacity', isFetching && !isPending && 'opacity-60')}>
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('orders.code')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.customer')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.items')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.placedAt')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.payment')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.status')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('orders.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3"><Skeleton className="h-8" /></td>
                    </tr>
                  ))
                : data?.items.map((o) => (
                    <tr key={o.id} className="relative hover:bg-muted/50">
                      <td className="px-4 py-3">
                        {/* The whole row is clickable through this link's stretched hit area */}
                        <Link to={`/admin/orders/${o.id}`} className="font-mono font-semibold after:absolute after:inset-0 hover:text-primary">
                          {o.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{o.fullName}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">{o.phone}</span>
                      </td>
                      <td className="max-w-56 px-4 py-3">
                        <span className="line-clamp-1">{o.firstProductName}</span>
                        <span className="text-xs text-muted-foreground">{t('orders.itemCount', { count: o.quantity })}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{f.dateTime(o.createdAt)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="block">{tc(`order.payment.${o.paymentMethod}`)}</span>
                        <span className="text-muted-foreground">{tc(`order.paymentStatus.${o.paymentStatus}`)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{f.money(o.total)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {data && data.items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('orders.empty')}</p> : null}
        </div>
      )}

      {data ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t('common.results', { count: data.totalItems })}</span>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update({ page: String(p) })} />
        </div>
      ) : null}
    </>
  )
}
