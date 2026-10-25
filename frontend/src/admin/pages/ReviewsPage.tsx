import { useState } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, Pagination } from '@/components/common'
import { RatingStars } from '@/components/product/parts'
import { Button } from '@/components/ui/button'
import { Checkbox, Select } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAdminReviews, useBulkReviews } from '../api-store'
import { ConfirmDialog, PageHeader, SearchField, Segmented, useDebounced } from '../ui'

type Status = 'all' | 'visible' | 'hidden'

export default function ReviewsPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const [status, setStatus] = useState<Status>('all')
  const [rating, setRating] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())
  const { data, isPending, isError, isFetching, refetch } = useAdminReviews({ status: status === 'all' ? undefined : status, rating, search: q || undefined, page })
  const bulk = useBulkReviews()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const reset = () => {
    setSelected(new Set())
    setPage(1)
  }
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const run = (action: 'show' | 'hide' | 'delete', ids = [...selected]) =>
    bulk.mutate(
      { ids, action },
      {
        onSuccess: ({ affected }) => {
          toast.success(t(`reviews.done.${action}`, { count: affected }))
          setSelected(new Set())
          setConfirmDelete(false)
        },
        onError: (e) => toast.error(errorMessage(tc, e)),
      },
    )

  return (
    <>
      <PageHeader title={t('reviews.title')} description={t('reviews.subtitle')} />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label={t('reviews.statusFilter')}
          value={status}
          onChange={(v) => {
            setStatus(v)
            reset()
          }}
          options={(['all', 'visible', 'hidden'] as const).map((s) => ({ value: s, label: t(`reviews.statuses.${s}`) }))}
        />
        <label className="w-40">
          <span className="sr-only">{t('reviews.rating')}</span>
          <Select
            value={rating ?? ''}
            onChange={(e) => {
              setRating(e.target.value ? Number(e.target.value) : undefined)
              reset()
            }}
          >
            <option value="">{t('reviews.allRatings')}</option>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{t('reviews.stars', { count: r })}</option>)}
          </Select>
        </label>
        <SearchField
          className="w-full sm:w-72"
          value={search}
          onChange={(v) => {
            setSearch(v)
            reset()
          }}
          placeholder={t('reviews.searchPlaceholder')}
        />
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-16 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-card px-4 py-2.5 shadow-sm" role="region" aria-label={t('products.bulkActions')}>
          <span className="mr-2 text-sm font-medium">{t('reviews.selected', { count: selected.size })}</span>
          <Button size="sm" variant="outline" onClick={() => run('show')}><Eye /> {t('reviews.show')}</Button>
          <Button size="sm" variant="outline" onClick={() => run('hide')}><EyeOff /> {t('reviews.hide')}</Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> {t('products.delete')}</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>{t('common.clearSelection')}</Button>
        </div>
      ) : null}

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <ul className={cn('mt-4 space-y-3 transition-opacity', isFetching && !isPending && 'opacity-60')}>
          {isPending
            ? Array.from({ length: 4 }, (_, i) => <li key={i}><Skeleton className="h-28 rounded-2xl" /></li>)
            : data?.items.map((r) => (
                <li key={r.id} className={cn('flex gap-4 rounded-2xl border border-border bg-card p-4', selected.has(r.id) && 'border-primary/50 bg-primary/5', !r.isVisible && 'opacity-80')}>
                  <Checkbox className="mt-1" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={t('reviews.select', { name: r.authorName })} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <RatingStars value={r.rating} />
                      <span className="text-sm font-medium">{r.authorName}</span>
                      <span className="text-xs text-muted-foreground">{r.authorEmail} · {f.dateTime(r.createdAt)}</span>
                      {r.isVisible ? null : <Badge variant="muted">{t('reviews.statuses.hidden')}</Badge>}
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-line">{r.comment || <span className="text-muted-foreground italic">{t('reviews.noComment')}</span>}</p>
                    <Link to={`/admin/products/${r.productId}`} className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary">
                      <span className="block size-7 overflow-hidden rounded-md bg-muted">
                        {r.productImage ? <img src={r.productImage} alt="" className="size-full object-cover" loading="lazy" /> : null}
                      </span>
                      {r.productName}
                    </Link>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button variant="ghost" size="sm" onClick={() => run(r.isVisible ? 'hide' : 'show', [r.id])}>
                      {r.isVisible ? <EyeOff /> : <Eye />} {r.isVisible ? t('reviews.hide') : t('reviews.show')}
                    </Button>
                  </div>
                </li>
              ))}
        </ul>
      )}
      {data && data.items.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t('reviews.empty')}</p> : null}
      {data ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t('common.results', { count: data.totalItems })}</span>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('reviews.deleteTitle', { count: selected.size })}
        text={t('reviews.deleteText')}
        confirmLabel={t('products.delete')}
        destructive
        loading={bulk.isPending}
        onConfirm={() => run('delete')}
      />
    </>
  )
}
