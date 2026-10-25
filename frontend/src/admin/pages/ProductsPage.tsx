import { useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, Pagination } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox, Select } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAdminCatalog, useAdminProducts, useBulkProducts } from '../api'
import type { ProductSort, ProductStatusFilter } from '../types'
import { ConfirmDialog, PageHeader, SearchField, Segmented, useDebounced } from '../ui'

const STATUSES: ProductStatusFilter[] = ['all', 'active', 'inactive', 'on_sale', 'low_stock', 'out_of_stock']
const SORTS: ProductSort[] = ['newest', 'best_selling', 'name', 'price_asc', 'price_desc', 'stock_asc']

export default function ProductsPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as ProductStatusFilter | null) ?? 'all'
  const sort = (params.get('sort') as ProductSort | null) ?? 'newest'
  const categoryId = params.get('category') ? Number(params.get('category')) : undefined
  const page = Number(params.get('page') ?? 1)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search.trim())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const update = (changes: Record<string, string | null>) => {
    setSelected(new Set())
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
  }

  const { data, isPending, isError, isFetching, refetch } = useAdminProducts({
    search: q || undefined,
    categoryId,
    status,
    sort,
    page,
    pageSize: 20,
  })
  const { data: catalog } = useAdminCatalog()
  const bulk = useBulkProducts()

  const ids = data?.items.map((p) => p.id) ?? []
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const runBulk = (action: 'activate' | 'deactivate' | 'delete') =>
    bulk.mutate(
      { ids: [...selected], action },
      {
        onSuccess: ({ affected }) => {
          toast.success(t(`products.bulkDone.${action}`, { count: affected }))
          setSelected(new Set())
          setConfirmDelete(false)
        },
        onError: (e) => toast.error(errorMessage(tc, e)),
      },
    )

  return (
    <>
      <PageHeader
        title={t('products.title')}
        description={data ? t('products.subtitle', { count: data.totalItems }) : undefined}
        actions={
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus /> {t('products.new')}
            </Link>
          </Button>
        }
      />

      <Segmented
        label={t('products.statusFilter')}
        value={status}
        onChange={(v) => update({ status: v === 'all' ? null : v })}
        options={STATUSES.map((s) => ({ value: s, label: t(`products.status.${s}`) }))}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchField
          className="w-full sm:w-80"
          value={search}
          onChange={(v) => {
            setSearch(v)
            update({ q: v.trim() || null })
          }}
          placeholder={t('products.searchPlaceholder')}
        />
        <label className="w-full sm:w-60">
          <span className="sr-only">{t('products.category')}</span>
          <Select value={categoryId ?? ''} onChange={(e) => update({ category: e.target.value || null })}>
            <option value="">{t('products.allCategories')}</option>
            {catalog?.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {c.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </label>
        <label className="w-full sm:w-52">
          <span className="sr-only">{t('products.sortBy')}</span>
          <Select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}>
            {SORTS.map((s) => (
              <option key={s} value={s}>{t(`products.sort.${s}`)}</option>
            ))}
          </Select>
        </label>
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-16 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-card px-4 py-2.5 shadow-sm" role="region" aria-label={t('products.bulkActions')}>
          <span className="mr-2 text-sm font-medium">{t('products.selected', { count: selected.size })}</span>
          <Button size="sm" variant="outline" loading={bulk.isPending && bulk.variables?.action === 'activate'} onClick={() => runBulk('activate')}>
            <Eye /> {t('products.show')}
          </Button>
          <Button size="sm" variant="outline" loading={bulk.isPending && bulk.variables?.action === 'deactivate'} onClick={() => runBulk('deactivate')}>
            <EyeOff /> {t('products.hide')}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> {t('products.delete')}
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            {t('common.clearSelection')}
          </Button>
        </div>
      ) : null}

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className={cn('relative mt-4 overflow-x-auto rounded-2xl border border-border bg-card transition-opacity', isFetching && !isPending && 'opacity-60')}>
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
                    aria-label={t('products.selectAll')}
                  />
                </th>
                <th className="px-2 py-3 font-medium">{t('products.dish')}</th>
                <th className="px-4 py-3 font-medium">{t('products.category')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('products.price')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('products.stock')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('products.sold')}</th>
                <th className="px-4 py-3 font-medium">{t('products.visibility')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3"><Skeleton className="h-10" /></td>
                    </tr>
                  ))
                : data?.items.map((p) => (
                    <tr key={p.id} className={cn('hover:bg-muted/50', selected.has(p.id) && 'bg-primary/5')}>
                      <td className="px-4 py-2.5">
                        <Checkbox checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={t('products.selectOne', { name: p.name })} />
                      </td>
                      <td className="px-2 py-2.5">
                        <Link to={`/admin/products/${p.id}`} className="group flex items-center gap-3">
                          <span className="block size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-72 truncate font-medium group-hover:text-primary">{p.name}</span>
                            <span className="block font-mono text-xs text-muted-foreground">{p.code}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.categoryName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {p.isOnSale && p.salePrice ? (
                          <>
                            <span className="block font-semibold text-sale">{f.money(p.salePrice)}</span>
                            <span className="block text-xs text-muted-foreground line-through">{f.money(p.price)}</span>
                          </>
                        ) : (
                          <span className="font-semibold">{f.money(p.price)}</span>
                        )}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-medium tabular-nums', p.quantity === 0 ? 'text-sale' : p.quantity <= 10 ? 'text-warning' : '')}>
                        {p.quantity === 0 ? t('products.soldOut') : f.number(p.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.number(p.soldCount)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={p.isActive ? 'success' : 'muted'}>{p.isActive ? t('products.visible') : t('products.hidden')}</Badge>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {data && data.items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('products.empty')}</p> : null}
        </div>
      )}

      {data ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t('common.results', { count: data.totalItems })}</span>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update({ page: String(p) })} />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('products.deleteTitle', { count: selected.size })}
        text={t('products.deleteText')}
        confirmLabel={t('products.delete')}
        destructive
        loading={bulk.isPending}
        onConfirm={() => runBulk('delete')}
      />
    </>
  )
}
