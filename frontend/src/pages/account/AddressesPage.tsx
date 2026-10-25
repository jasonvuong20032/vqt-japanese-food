import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAddresses, useDeleteAddress, useSaveAddress } from '@/api/hooks'
import type { Address } from '@/api/types'
import { ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select } from '@/components/ui/form'
import { Badge, EmptyState, Skeleton } from '@/components/ui/misc'
import { Dialog, DialogContent } from '@/components/ui/overlay'
import { applyFieldErrors, errorMessage, fieldError } from '@/lib/errors'
import { PROVINCES } from '@/lib/provinces'

const schema = z.object({
  fullName: z.string().trim().min(2, 'required'),
  phone: z.string().refine((v) => /^(0|\+?84)\d{9}$/.test(v.replace(/[\s.-]/g, '')), 'invalid_phone'),
  province: z.string().min(1, 'required'),
  ward: z.string(),
  street: z.string().trim().min(3, 'required'),
  isDefault: z.boolean(),
})
type Values = z.infer<typeof schema>
const empty: Values = { fullName: '', phone: '', province: 'Hồ Chí Minh', ward: '', street: '', isDefault: false }

function AddressForm({ address, onDone }: { address?: Address; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveAddress()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: address
      ? { fullName: address.fullName, phone: address.phone, province: address.province ?? 'Hồ Chí Minh', ward: address.ward ?? '', street: address.street, isDefault: address.isDefault }
      : empty,
  })

  const onSubmit = (v: Values) =>
    save.mutate(
      { id: address?.id, ...v, ward: v.ward || null },
      {
        onSuccess: () => {
          toast.success(t('account.saved'))
          onDone()
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError, ['fullName', 'phone', 'province', 'street'])) toast.error(errorMessage(t, error))
        },
      },
    )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('checkout.fullName')} error={fieldError(t, errors.fullName?.message)}>
          {(id) => <Input id={id} aria-invalid={!!errors.fullName} {...register('fullName')} />}
        </Field>
        <Field label={t('checkout.phone')} error={fieldError(t, errors.phone?.message)}>
          {(id) => <Input id={id} type="tel" aria-invalid={!!errors.phone} {...register('phone')} />}
        </Field>
        <Field label={t('checkout.province')}>
          {(id) => (
            <Select id={id} {...register('province')}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('checkout.ward')} optional={t('common.optional')}>
          {(id) => <Input id={id} {...register('ward')} />}
        </Field>
        <Field label={t('checkout.street')} error={fieldError(t, errors.street?.message)} className="sm:col-span-2">
          {(id) => <Input id={id} aria-invalid={!!errors.street} {...register('street')} />}
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox {...register('isDefault')} /> {t('account.makeDefault')}
      </label>
      <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
    </form>
  )
}

export default function AddressesPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useAddresses()
  const remove = useDeleteAddress()
  const [editing, setEditing] = useState<Address | 'new' | null>(null)

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">{t('account.addresses')}</h2>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus /> {t('account.addAddress')}
        </Button>
      </div>

      {!data?.length ? (
        <EmptyState icon={<MapPin />} title={t('account.noAddresses')} className="rounded-3xl border border-border bg-card" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((a) => (
            <li key={a.id} className="rounded-3xl border border-border bg-card p-5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {a.fullName} {a.isDefault ? <Badge variant="muted" className="ml-1">{t('account.default')}</Badge> : null}
                </p>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing(a)} aria-label={t('common.edit')}><Pencil /></Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="hover:text-sale"
                    aria-label={t('common.delete')}
                    onClick={() => remove.mutate(a.id, { onSuccess: () => toast.success(t('account.deleted')) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground">{a.phone}</p>
              <p className="mt-1 text-muted-foreground">{[a.street, a.ward, a.province].filter(Boolean).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent title={editing === 'new' ? t('account.addAddress') : t('account.editAddress')} closeLabel={t('common.close')}>
          {editing !== null ? <AddressForm address={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
