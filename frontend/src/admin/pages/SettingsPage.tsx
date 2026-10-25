import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/misc'
import { errorMessage, fieldError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { AdminOnly } from '../AdminLayout'
import { useSaveSettings, useSettings } from '../api-store'
import type { StoreSettings } from '../types'
import { PageHeader, Panel, serverFieldErrors } from '../ui'

export default function SettingsPage() {
  return (
    <AdminOnly>
      <Settings />
    </AdminOnly>
  )
}

function Settings() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const { data, isPending, isError, refetch } = useSettings()
  const save = useSaveSettings()
  const [form, setForm] = useState<StoreSettings | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isPending || !form) return <Skeleton className="h-96 rounded-2xl" />

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setForm((v) => (v ? { ...v, [key]: value } : v))
    setErrors((e) => ({ ...e, [key]: '' }))
  }
  const err = (key: string) => (errors[key] ? fieldError(tc, errors[key]) : undefined)
  const dirty = JSON.stringify(form) !== JSON.stringify(data)
  const text = (key: keyof StoreSettings, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label} error={err(key)}>
      {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors[key]} value={String(form[key])} onChange={(e) => set(key, e.target.value as never)} {...props} />}
    </Field>
  )
  const money = (key: keyof StoreSettings, label: string, hint?: string) => (
    <Field label={label} hint={hint} error={err(key)}>
      {(id, d) => (
        <Input id={id} aria-describedby={d} aria-invalid={!!errors[key]} inputMode="numeric" value={String(form[key])}
          onChange={(e) => set(key, (Number(e.target.value.replace(/\D/g, '')) || 0) as never)} />
      )}
    </Field>
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(form, {
          onSuccess: () => toast.success(t('settings.saved')),
          onError: (err2) => {
            const fields = serverFieldErrors(err2)
            if (Object.keys(fields).length > 0) setErrors(fields)
            else toast.error(errorMessage(tc, err2))
          },
        })
      }}
    >
      <PageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
        actions={<Button type="submit" loading={save.isPending} disabled={!dirty}><Save /> {t('productEdit.save')}</Button>}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={t('settings.store')}>
          <div className="space-y-4">
            {text('storeName', t('settings.storeName'))}
            <div className="grid gap-4 sm:grid-cols-2">
              {text('storePhone', t('orders.phone'), { inputMode: 'tel' })}
              {text('storeEmail', t('orders.email'), { type: 'email' })}
            </div>
            {text('storeAddress', t('orders.address'))}
            {text('openingHours', t('settings.openingHours'), { placeholder: '10:00 - 22:00' })}
            <Field label={t('settings.websiteUrl')} hint={t('settings.websiteUrlHint')} error={err('websiteUrl')}>
              {(id, d) => (
                <Input id={id} aria-describedby={d} aria-invalid={!!errors.websiteUrl} type="url" inputMode="url" placeholder="https://"
                  value={form.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} />
              )}
            </Field>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={t('settings.delivery')}>
            <div className="grid gap-4 sm:grid-cols-2">
              {money('shippingFee', t('settings.shippingFee'), f.money(form.shippingFee))}
              {money('freeShippingThreshold', t('settings.freeThreshold'), t('settings.freeThresholdHint', { amount: f.money(form.freeShippingThreshold) }))}
            </div>
          </Panel>
          <Panel title={t('settings.inventory')}>
            <Field label={t('settings.lowStock')} hint={t('settings.lowStockHint')} error={err('lowStockThreshold')}>
              {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} max={1000} value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', Number(e.target.value) || 0)} />}
            </Field>
          </Panel>
          <p className="text-xs text-muted-foreground">{t('settings.note')}</p>
        </div>
      </div>
    </form>
  )
}
