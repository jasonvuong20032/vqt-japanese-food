import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { api } from '@/api/client'
import type { PhotoCredit } from '@/api/types'
import { Container, ErrorState, PageMeta } from '@/components/common'
import { Skeleton } from '@/components/ui/misc'
import { useLang } from '@/stores/ui'

/** Attribution for openly licensed photos (CC BY requires naming the author, licence and source). */
export default function CreditsPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['credits', lang],
    queryFn: () => api<PhotoCredit[]>('/api/store/credits'),
    staleTime: 10 * 60_000,
  })

  return (
    <>
      <PageMeta title={t('credits.title')} />
      <Container className="py-10 md:py-14">
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{t('credits.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t('credits.subtitle')}</p>

        {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />) : null}
          {data?.map((c) => {
            const [author, license, source] = c.credit.split(' · ')
            return (
              <li key={c.imageUrl} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                <img src={c.imageUrl} alt="" loading="lazy" className="size-20 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 text-sm">
                  {c.slug ? (
                    <Link to={`/p/${c.slug}`} className="font-semibold hover:text-primary">{c.name}</Link>
                  ) : (
                    <p className="font-semibold">{c.name}</p>
                  )}
                  <p className="truncate text-muted-foreground">{t('credits.by', { author })}</p>
                  <p className="text-xs text-muted-foreground">{license}</p>
                  {source ? (
                    <a href={source} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      {t('credits.source')} <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </Container>
    </>
  )
}
