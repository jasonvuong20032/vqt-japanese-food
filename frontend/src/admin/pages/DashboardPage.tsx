import { useState } from 'react'
import { ChartArea, Table2, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/order/OrderParts'
import { ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'
import { useAdminOrders, useDashboard } from '../api'
import { AreaChart, BarList } from '../charts'
import { PageHeader, Panel, relativeChange, StatTile } from '../ui'

const STATUS_ORDER = [0, 1, 3, 4, 5, 2, 6]

export default function DashboardPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const { data, isPending, isError, refetch, dataUpdatedAt } = useDashboard()
  const latest = useAdminOrders({ page: 1, pageSize: 6 })
  const [asTable, setAsTable] = useState(false)

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  const day = (iso: string) => new Intl.DateTimeFormat(f.locale, { day: '2-digit', month: '2-digit' }).format(new Date(iso))

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={data ? t('dashboard.updated', { time: new Intl.DateTimeFormat(f.locale, { timeStyle: 'short' }).format(dataUpdatedAt) }) : undefined}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {isPending || !data ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatTile label={t('dashboard.revenueToday')} value={f.money(data.today.revenue)} hint={t('dashboard.ordersCount', { count: data.today.orders })} />
            <StatTile
              label={t('dashboard.revenue30')}
              value={f.money(data.last30Days.revenue)}
              change={relativeChange(data.last30Days.revenue, data.previous30Days.revenue)}
              changeLabel={t('dashboard.vsPrevious30')}
            />
            <StatTile
              label={t('dashboard.orders30')}
              value={f.number(data.last30Days.orders)}
              change={relativeChange(data.last30Days.orders, data.previous30Days.orders)}
              changeLabel={t('dashboard.vsPrevious30')}
            />
            <StatTile
              label={t('dashboard.aov30')}
              value={f.money(data.last30Days.averageOrderValue)}
              change={relativeChange(data.last30Days.averageOrderValue, data.previous30Days.averageOrderValue)}
              changeLabel={t('dashboard.vsPrevious30')}
            />
            <StatTile
              label={t('dashboard.pending')}
              value={f.number(data.pendingOrders)}
              tone={data.pendingOrders > 0 ? 'warning' : undefined}
              hint={data.pendingOrders > 0 ? t('dashboard.pendingHint') : t('dashboard.pendingNone')}
              href="/admin/orders?status=0"
            />
            <StatTile label={t('dashboard.newCustomers')} value={f.number(data.newCustomers30Days)} hint={t('dashboard.last30')} />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={t('dashboard.revenueChart')}
          action={
            <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
              {asTable ? <ChartArea /> : <Table2 />} {asTable ? t('dashboard.showChart') : t('dashboard.showTable')}
            </Button>
          }
        >
          {!data ? (
            <Skeleton className="h-60 rounded-xl" />
          ) : asTable ? (
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">{t('dashboard.day')}</th>
                    <th className="py-2 text-right font-medium">{t('dashboard.revenue')}</th>
                    <th className="py-2 text-right font-medium">{t('dashboard.orders')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {[...data.revenueByDay].reverse().map((d) => (
                    <tr key={d.date}>
                      <td className="py-1.5">{f.date(d.date)}</td>
                      <td className="py-1.5 text-right">{f.money(d.revenue)}</td>
                      <td className="py-1.5 text-right">{f.number(d.orders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{t('dashboard.revenueChartHint')}</p>
              <AreaChart
                ariaLabel={t('dashboard.revenueChart')}
                emptyText={t('dashboard.noRevenue')}
                points={data.revenueByDay.map((d) => ({
                  label: day(d.date),
                  value: d.revenue,
                  details: [{ label: t('dashboard.orders'), value: f.number(d.orders) }],
                }))}
                formatValue={f.money}
                formatAxis={f.compact}
              />
            </>
          )}
        </Panel>

        <Panel title={t('dashboard.byStatus')}>
          {!data ? (
            <Skeleton className="h-60 rounded-xl" />
          ) : (
            <BarList
              items={STATUS_ORDER.map((s) => ({
                key: String(s),
                label: tc(`order.status.${s}`),
                value: data.ordersByStatus[String(s)] ?? 0,
                href: `/admin/orders?status=${s}`,
              }))}
              formatValue={f.number}
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title={t('dashboard.topProducts')} bodyClassName="p-0">
          {!data ? (
            <Skeleton className="m-5 h-48 rounded-xl" />
          ) : data.topProducts.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">{t('dashboard.noSales')}</p>
          ) : (
            <ol className="divide-y divide-border">
              {data.topProducts.map((p, i) => (
                <li key={p.productId}>
                  <Link to={`/admin/products/${p.productId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                    <span className="w-4 text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="block size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{t('dashboard.unitsSold', { count: p.unitsSold })}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{f.money(p.revenue)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title={t('dashboard.lowStock')} bodyClassName="p-0">
          {!data ? (
            <Skeleton className="m-5 h-48 rounded-xl" />
          ) : data.lowStock.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">{t('dashboard.stockOk')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.lowStock.map((p) => (
                <li key={p.productId}>
                  <Link to={`/admin/products/${p.productId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{p.code}</span>
                    </span>
                    <span className={p.quantity === 0 ? 'flex items-center gap-1 text-sm font-semibold text-sale' : 'flex items-center gap-1 text-sm font-semibold text-warning'}>
                      <TriangleAlert className="size-4" aria-hidden />
                      {p.quantity === 0 ? t('dashboard.outOfStock') : t('dashboard.left', { count: p.quantity })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('dashboard.latestOrders')} action={<Link to="/admin/orders" className="text-sm font-medium text-primary hover:underline">{t('common.viewAll')}</Link>} bodyClassName="p-0">
          {!latest.data ? (
            <Skeleton className="m-5 h-48 rounded-xl" />
          ) : latest.data.items.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">{t('orders.empty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {latest.data.items.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-semibold">{o.code}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.fullName} · {f.dateTime(o.createdAt)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">{f.money(o.total)}</span>
                      <StatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
