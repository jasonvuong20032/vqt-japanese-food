import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ErrorState, Pagination } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { Dialog, DialogContent } from '@/components/ui/overlay'
import { errorMessage, fieldError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCoupons, useDeleteCoupon, useSaveCoupon } from '../api-store'
import type { AdminCoupon, CouponInput, CouponState } from '../types'
import { ConfirmDialog, PageHeader, SearchField, Segmented, serverFieldErrors, useDebounced } from '../ui'

const STATES: (CouponState | 'all')[] = ['all', 'active', 'scheduled', 'expired', 'used_up', 'disabled']
const STATE_BADGE: Record<CouponState, 'success' | 'info' | 'muted' | 'warning'> = {
  active: 'success',
  scheduled: 'info',
  expired: 'muted',
  used_up: 'warning',
  disabled: 'muted',
}

export default function CouponsPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const [state, setState] = useState<CouponState | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())
  const { data, isPending, isError, isFetching, refetch } = useCoupons({ search: q || undefined, state: state === 'all' ? undefined : state, page })
  const [editing, setEditing] = useState<AdminCoupon | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminCoupon | null>(null)
  const remove = useDeleteCoupon()

  const discount = (c: AdminCoupon) =>
    c.type === 1
      ? `${f.number(c.value)}%${c.maxDiscountAmount ? ` · ${t('coupons.upTo', { amount: f.money(c.maxDiscountAmount) })}` : ''}`
      : f.money(c.value)
  const shortDate = (iso: string | null) => (iso ? f.dateTime(iso) : null)

  return (
    <>
      <PageHeader
        title={t('coupons.title')}
        description={t('coupons.subtitle')}
        actions={<Button onClick={() => setEditing('new')}><Plus /> {t('coupons.new')}</Button>}
      />
      <Segmented
        label={t('coupons.stateFilter')}
        value={state}
        onChange={(v) => {
          setState(v)
          setPage(1)
        }}
        options={STATES.map((s) => ({ value: s, label: t(`coupons.states.${s}`) }))}
      />
      <SearchField
        className="mt-4 w-full sm:w-80"
        value={search}
        onChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder={t('coupons.searchPlaceholder')}
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className={cn('relative mt-4 overflow-x-auto rounded-2xl border border-border bg-card transition-opacity', isFetching && !isPending && 'opacity-60')}>
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('coupons.code')}</th>
                <th className="px-4 py-3 font-medium">{t('coupons.discount')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('coupons.minOrder')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('coupons.used')}</th>
                <th className="px-4 py-3 font-medium">{t('coupons.validity')}</th>
                <th className="px-4 py-3 font-medium">{t('coupons.state')}</th>
                <th className="px-4 py-3"><span className="sr-only">{t('coupons.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending
                ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-9" /></td></tr>)
                : data?.items.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <span className="block font-mono font-semibold">{c.code}</span>
                        {c.description ? <span className="line-clamp-1 max-w-64 text-xs text-muted-foreground">{c.description}</span> : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{discount(c)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.minOrderAmount > 0 ? f.money(c.minOrderAmount) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.usageLimit ? `${f.number(c.usedCount)} / ${f.number(c.usageLimit)}` : f.number(c.usedCount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.startsAt || c.expiresAt ? (
                          <>
                            {shortDate(c.startsAt) ? <span className="block">{t('coupons.from', { date: shortDate(c.startsAt) })}</span> : null}
                            {shortDate(c.expiresAt) ? <span className="block">{t('coupons.until', { date: shortDate(c.expiresAt) })}</span> : null}
                          </>
                        ) : (
                          t('coupons.noLimit')
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge variant={STATE_BADGE[c.state]}>{t(`coupons.states.${c.state}`)}</Badge></td>
                      <td className="px-4 py-3">
                        <span className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label={t('catalog.editNamed', { name: c.code })}><Pencil /></Button>
                          <Button variant="ghost" size="icon-sm" className="text-sale" onClick={() => setDeleting(c)} aria-label={t('catalog.deleteNamed', { name: c.code })}><Trash2 /></Button>
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {data && data.items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('coupons.empty')}</p> : null}
        </div>
      )}
      {data ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t('common.results', { count: data.totalItems })}</span>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      ) : null}

      {editing ? <CouponDialog coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('coupons.deleteTitle', { code: deleting?.code ?? '' })}
        text={t('coupons.deleteText')}
        confirmLabel={t('products.delete')}
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('coupons.deleted', { code: deleting.code }))
              setDeleting(null)
            },
            onError: (e) => toast.error(errorMessage(tc, e)),
          })
        }
      />
    </>
  )
}

/** "2026-10-10T08:00:00" <-> the value of an <input type="datetime-local"> (store-local time, no zone). */
const toInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '')
const fromInput = (value: string) => (value ? `${value}:00` : null)

function CouponDialog({ coupon, onClose }: { coupon: AdminCoupon | null; onClose: () => void }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const save = useSaveCoupon()
  const [form, setForm] = useState<CouponInput>(() => ({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: coupon?.type ?? 1,
    value: coupon?.value ?? 10,
    minOrderAmount: coupon?.minOrderAmount ?? 0,
    maxDiscountAmount: coupon?.maxDiscountAmount ?? null,
    usageLimit: coupon?.usageLimit ?? null,
    startsAt: coupon?.startsAt ?? null,
    expiresAt: coupon?.expiresAt ?? null,
    isActive: coupon?.isActive ?? true,
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) => {
    setForm((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }
  const num = (value: string) => (value.trim() === '' ? null : Number(value))
  const err = (key: string) => (errors[key] ? fieldError(tc, errors[key]) : undefined)

  const submit = () =>
    save.mutate(
      { id: coupon?.id ?? null, input: { ...form, code: form.code.trim().toUpperCase(), description: form.description?.trim() || null } },
      {
        onSuccess: (saved) => {
          toast.success(t('coupons.saved', { code: saved.code }))
          onClose()
        },
        onError: (e) => {
          const fields = serverFieldErrors(e)
          if (Object.keys(fields).length > 0) setErrors(fields)
          else toast.error(errorMessage(tc, e))
        },
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={coupon ? t('coupons.edit', { code: coupon.code }) : t('coupons.new')} closeLabel={t('common.cancel')} className="max-w-xl">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('coupons.code')} hint={t('coupons.codeHint')} error={err('code')}>
              {(id, d) => (
                <Input id={id} aria-describedby={d} aria-invalid={!!errors.code} className="font-mono uppercase" value={form.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={30} autoComplete="off" />
              )}
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">{t('coupons.type')}</legend>
              <Segmented
                label={t('coupons.type')}
                value={form.type}
                onChange={(v) => set('type', v)}
                options={[{ value: 1 as const, label: t('coupons.percent') }, { value: 2 as const, label: t('coupons.fixed') }]}
              />
            </fieldset>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={form.type === 1 ? t('coupons.valuePercent') : t('coupons.valueAmount')} error={err('value')}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.value} inputMode="decimal" value={form.value} onChange={(e) => set('value', Number(e.target.value) || 0)} />}
            </Field>
            {form.type === 1 ? (
              <Field label={t('coupons.maxDiscount')} optional={tc('common.optional')} error={err('maxDiscountAmount')}>
                {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={form.maxDiscountAmount ?? ''} onChange={(e) => set('maxDiscountAmount', num(e.target.value))} />}
              </Field>
            ) : <span />}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('coupons.minOrder')} error={err('minOrderAmount')}>
              {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={form.minOrderAmount} onChange={(e) => set('minOrderAmount', Number(e.target.value) || 0)} />}
            </Field>
            <Field label={t('coupons.usageLimit')} hint={t('coupons.usageLimitHint')} optional={tc('common.optional')} error={err('usageLimit')}>
              {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" value={form.usageLimit ?? ''} onChange={(e) => set('usageLimit', num(e.target.value))} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('coupons.startsAt')} optional={tc('common.optional')} error={err('startsAt')}>
              {(id, d) => <Input id={id} aria-describedby={d} type="datetime-local" value={toInput(form.startsAt)} onChange={(e) => set('startsAt', fromInput(e.target.value))} />}
            </Field>
            <Field label={t('coupons.expiresAt')} optional={tc('common.optional')} error={err('expiresAt')}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.expiresAt} type="datetime-local" value={toInput(form.expiresAt)} onChange={(e) => set('expiresAt', fromInput(e.target.value))} />}
            </Field>
          </div>
          <Field label={t('coupons.description')} hint={t('coupons.descriptionHint')} optional={tc('common.optional')} error={err('description')}>
            {(id, d) => <Textarea id={id} aria-describedby={d} rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />}
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <Checkbox checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            <span className="text-sm font-medium">{t('coupons.isActive')}</span>
          </label>
          {coupon ? <p className="text-xs text-muted-foreground">{t('coupons.usedSoFar', { count: coupon.usedCount })}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{t('productEdit.save')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
