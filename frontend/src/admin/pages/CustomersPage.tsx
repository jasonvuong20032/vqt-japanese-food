import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ErrorState, Pagination } from '@/components/common'
import { Select } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCustomers } from '../api-store'
import type { AdminCustomerQuery } from '../types'
import { PageHeader, SearchField, Segmented, useDebounced } from '../ui'
import { AccountBadges } from './customerParts'

const SORTS = ['newest', 'spent', 'orders', 'name'] as const
const STATUSES = ['', 'active', 'unverified', 'locked'] as const

export default function CustomersPage() {
  const { t } = useTranslation('admin')
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const role = (params.get('role') as AdminCustomerQuery['role'] | null) ?? undefined
  const status = (params.get('status') as AdminCustomerQuery['status'] | null) ?? undefined
  const sort = (params.get('sort') as AdminCustomerQuery['sort'] | null) ?? 'newest'
  const page = Number(params.get('page') ?? 1)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search.trim())

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (!v) next.delete(k)
          else next.set(k, v)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )

  const { data, isPending, isError, isFetching, refetch } = useCustomers({ search: q || undefined, role, status, sort, page, pageSize: 20 })

  return (
    <>
      <PageHeader title={t('customers.title')} description={data ? t('customers.subtitle', { count: data.totalItems }) : undefined} />

      <Segmented
        label={t('customers.roleFilter')}
        value={role ?? 'all'}
        onChange={(v) => update({ role: v === 'all' ? null : v })}
        options={[
          { value: 'all', label: t('customers.roles.all') },
          { value: 'customer', label: t('customers.roles.customer') },
          { value: 'staff', label: t('customers.roles.staff') },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchField
          className="w-full sm:w-80"
          value={search}
          onChange={(v) => {
            setSearch(v)
            update({ q: v.trim() || null })
          }}
          placeholder={t('customers.searchPlaceholder')}
        />
        <label className="w-full sm:w-52">
          <span className="sr-only">{t('customers.status')}</span>
          <Select value={status ?? ''} onChange={(e) => update({ status: e.target.value || null })}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`customers.statuses.${s || 'all'}`)}</option>)}
          </Select>
        </label>
        <label className="w-full sm:w-52">
          <span className="sr-only">{t('products.sortBy')}</span>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}>
            {SORTS.map((s) => <option key={s} value={s}>{t(`customers.sort.${s}`)}</option>)}
          </Select>
        </label>
      </div>

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className={cn('relative mt-4 overflow-x-auto rounded-2xl border border-border bg-card transition-opacity', isFetching && !isPending && 'opacity-60')}>
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('customers.customer')}</th>
                <th className="px-4 py-3 font-medium">{t('orders.phone')}</th>
                <th className="px-4 py-3 font-medium">{t('customers.status')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('customers.orders')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('customers.spent')}</th>
                <th className="px-4 py-3 font-medium">{t('customers.lastOrder')}</th>
                <th className="px-4 py-3 font-medium">{t('customers.joined')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-9" /></td></tr>
                  ))
                : data?.items.map((c) => (
                    <tr key={c.id} className="relative hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link to={`/admin/customers/${c.id}`} className="block font-medium after:absolute after:inset-0 hover:text-primary">{c.fullName}</Link>
                        <span className="block text-xs text-muted-foreground">{c.email}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{c.phone}</td>
                      <td className="px-4 py-3"><AccountBadges customer={c} /></td>
                      <td className="px-4 py-3 text-right tabular-nums">{f.number(c.orderCount)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{f.money(c.totalSpent)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{c.lastOrderAt ? f.date(c.lastOrderAt) : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{f.date(c.createdAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {data && data.items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('customers.empty')}</p> : null}
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
