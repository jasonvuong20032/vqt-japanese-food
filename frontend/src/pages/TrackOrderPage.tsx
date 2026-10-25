import { PackageSearch } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useTrackOrder } from '@/api/hooks'
import { ApiError } from '@/api/client'
import { Container, PageMeta } from '@/components/common'
import { OrderDetails, OrderTimeline, StatusBadge } from '@/components/order/OrderParts'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { Kanji } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'

export default function TrackOrderPage() {
  const { t } = useTranslation()
  const f = useFormat()
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [phone, setPhone] = useState(params.get('phone') ?? '')
  const track = useTrackOrder()

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (code.trim() && phone.trim()) track.mutate({ code: code.trim().toUpperCase(), phone })
  }

  // Coming from the success page with both values: look it up straight away
  useEffect(() => {
    if (params.get('code') && params.get('phone')) submit()
  }, [])

  const notFound = track.error instanceof ApiError && track.error.status === 404
  const order = track.data

  return (
    <>
      <PageMeta title={t('track.title')} />
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-xl text-center">
          <Kanji>追跡</Kanji>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">{t('track.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('track.subtitle')}</p>
        </div>

        <form onSubmit={submit} className="mx-auto mt-8 grid max-w-xl gap-4 rounded-3xl border border-border bg-card p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={t('track.code')}>
            {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="JF2610..." className="uppercase" required />}
          </Field>
          <Field label={t('checkout.phone')}>
            {(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />}
          </Field>
          <Button type="submit" loading={track.isPending}>
            <PackageSearch /> {t('track.submit')}
          </Button>
        </form>

        {track.isError ? (
          <p className="mx-auto mt-6 max-w-xl rounded-2xl bg-sale/10 px-5 py-4 text-center text-sm text-sale">
            {notFound ? t('track.notFound') : errorMessage(t, track.error)}
          </p>
        ) : null}

        {order ? (
          <div className="mt-12 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{f.dateTime(order.createdAt)}</p>
                <h2 className="font-mono text-2xl font-bold">{order.code}</h2>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="rounded-3xl border border-border bg-card p-6">
              <OrderTimeline order={order} />
            </div>
            <OrderDetails order={order} />
          </div>
        ) : null}
      </Container>
    </>
  )
}
