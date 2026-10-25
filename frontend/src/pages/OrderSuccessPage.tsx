import { CircleCheck, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { toast } from 'sonner'
import { useMe } from '@/api/hooks'
import { Container, PageMeta } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useFormat } from '@/lib/format'

export default function OrderSuccessPage() {
  const { code = '' } = useParams()
  const { t } = useTranslation()
  const f = useFormat()
  const { data: me } = useMe()
  const state = (useLocation().state ?? {}) as { total?: number; phone?: string }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t('success.copied'))
    } catch {
      /* clipboard can be blocked; the code is visible anyway */
    }
  }

  const steps = [t('success.step1'), t('success.step2'), t('success.step3')]
  const trackUrl = me ? `/account/orders/${code}` : `/track?code=${encodeURIComponent(code)}${state.phone ? `&phone=${encodeURIComponent(state.phone)}` : ''}`

  return (
    <>
      <PageMeta title={t('success.title')} />
      <Container className="max-w-2xl py-14 text-center md:py-20">
        <div className="mx-auto grid size-20 animate-[pop-in_400ms_cubic-bezier(0.16,1,0.3,1)] place-items-center rounded-full bg-success/15 text-success">
          <CircleCheck className="size-11" />
        </div>
        <p lang="ja" className="mt-6 font-jp tracking-[0.35em] text-primary">ありがとうございます</p>
        <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">{t('success.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('success.subtitle')}</p>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t('success.orderCode')}</p>
          <button onClick={copy} className="mt-1 inline-flex items-center gap-2 font-mono text-2xl font-bold tracking-wider hover:text-primary" aria-label={t('success.copy')}>
            {code} <Copy className="size-4" />
          </button>
          {state.total ? (
            <p className="mt-3 text-sm">
              {t('cart.total')}: <span className="font-semibold">{f.money(state.total)}</span> · {t('order.payment.0')}
            </p>
          ) : null}
          <ol className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3 rounded-2xl bg-muted p-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          {!me ? <p className="mt-4 text-xs text-muted-foreground">{t('success.trackHint')}</p> : null}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={trackUrl}>{t('success.track')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/menu">{t('success.continue')}</Link>
          </Button>
        </div>
      </Container>
    </>
  )
}
