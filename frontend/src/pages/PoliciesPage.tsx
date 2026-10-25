import { ChevronDown, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePolicies, useStore } from '@/api/hooks'
import { Container, ErrorState, PageMeta } from '@/components/common'
import { Kanji, Skeleton } from '@/components/ui/misc'

export default function PoliciesPage() {
  const { t } = useTranslation()
  const { data: policies, isLoading, isError, refetch } = usePolicies()
  const { data: store } = useStore()

  return (
    <>
      <PageMeta title={t('policies.title')} />
      <Container className="max-w-3xl py-10 md:py-14">
        <div className="text-center">
          <Kanji>ご案内</Kanji>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">{t('policies.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('policies.subtitle')}</p>
        </div>

        <div className="mt-10 space-y-3">
          {isLoading ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />) : null}
          {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
          {policies?.map((p, i) => (
            <details key={p.id} open={i === 0} className="group rounded-2xl border border-border bg-card px-5 open:shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {p.title}
                <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 leading-relaxed whitespace-pre-line text-muted-foreground">{p.content}</p>
            </details>
          ))}
        </div>

        {store ? (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-3xl bg-muted p-6 text-center">
            <p className="font-semibold">{t('policies.stillQuestions')}</p>
            <a href={`tel:${store.info.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-primary hover:underline">
              <Phone className="size-4" /> {store.info.phone}
            </a>
          </div>
        ) : null}
      </Container>
    </>
  )
}
