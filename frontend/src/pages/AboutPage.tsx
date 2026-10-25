import { ArrowRight, Quote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAbout } from '@/api/hooks'
import { Container, ErrorState, PageMeta } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge, Kanji, Skeleton } from '@/components/ui/misc'

function Credit({ text }: { text?: string }) {
  if (!text) return null
  return <span className="absolute right-3 bottom-2 rounded bg-black/45 px-2 py-0.5 text-[10px] text-white/80">{text.split(' · ').slice(0, 2).join(' · ')}</span>
}

export default function AboutPage() {
  const { t } = useTranslation()
  const { data: about, isLoading, isError, refetch } = useAbout()

  if (isLoading) {
    return (
      <Container className="space-y-6 py-10">
        <Skeleton className="h-[60vh] rounded-3xl" />
        <Skeleton className="h-40" />
      </Container>
    )
  }
  if (isError || !about) return <ErrorState onRetry={() => void refetch()} />

  const { hero, story, values, chef, journey, sourcing, closing } = about

  return (
    <>
      <PageMeta title={hero?.eyebrow ?? t('nav.about')} description={hero?.subtitle} image={hero?.image} />

      {/* Hero */}
      <section className="relative isolate flex min-h-[70vh] items-end overflow-hidden bg-black text-white">
        {hero?.image ? <img src={hero.image} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-70" fetchPriority="high" /> : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/50 to-black/10" />
        <Container className="pt-32 pb-14 md:pb-20">
          <span lang="ja" className="font-jp text-lg tracking-[0.45em] text-[#e9c98f]">物語</span>
          <p className="mt-3 text-sm font-semibold tracking-[0.25em] text-white/70 uppercase">{hero?.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl leading-[1.1] font-semibold text-balance md:text-6xl">{hero?.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">{hero?.subtitle}</p>
        </Container>
        <Credit text={hero?.imageCredit} />
      </section>

      {/* Story */}
      {story ? (
        <Container className="grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="space-y-5">
            <Kanji>始まり</Kanji>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">{story.title}</h2>
            {story.paragraphs?.map((p, i) => (
              <p key={i} className={i === 0 ? 'text-lg leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-6xl first-letter:leading-none first-letter:text-primary' : 'leading-relaxed text-muted-foreground'}>
                {p}
              </p>
            ))}
          </div>
          {story.image ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] md:aspect-[4/5]">
              <img src={story.image} alt="" loading="lazy" className="size-full object-cover" />
              <Credit text={story.imageCredit} />
            </div>
          ) : null}
        </Container>
      ) : null}

      {/* Values */}
      {values?.length ? (
        <section className="relative overflow-hidden bg-card py-20 md:py-24">
          <div className="pattern-seigaiha pointer-events-none absolute inset-0 opacity-50" />
          <Container className="relative">
            <div className="mb-12 text-center">
              <Kanji>心得</Kanji>
              <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">{t('about.values')}</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((v) => (
                <div key={v.kanji} className="rounded-3xl border border-border bg-background p-7 text-center transition-transform hover:-translate-y-1">
                  <span lang="ja" className="font-jp text-6xl leading-none text-primary">{v.kanji}</span>
                  <h3 className="mt-5 font-display text-xl font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Chef */}
      {chef ? (
        <Container className="grid items-center gap-12 py-20 md:grid-cols-[1fr_1.1fr] md:py-28">
          {chef.image ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] md:aspect-[4/5]">
              <img src={chef.image} alt="" loading="lazy" className="size-full object-cover" />
              <Credit text={chef.imageCredit} />
            </div>
          ) : null}
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Kanji>料理長</Kanji>
              {chef.isSample ? <Badge variant="warning">{t('about.sample')}</Badge> : null}
            </div>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">{chef.name}</h2>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">{chef.role}</p>
            {chef.bio?.map((p, i) => (
              <p key={i} className="leading-relaxed text-muted-foreground">{p}</p>
            ))}
            {chef.quote ? (
              <blockquote className="relative mt-6 rounded-3xl bg-muted p-7">
                <Quote className="absolute -top-3 left-6 size-8 rounded-full bg-primary p-1.5 text-primary-foreground" />
                <p className="font-display text-xl leading-relaxed italic">“{chef.quote}”</p>
              </blockquote>
            ) : null}
          </div>
        </Container>
      ) : null}

      {/* Journey */}
      {journey?.steps?.length ? (
        <section className="bg-secondary py-20 text-secondary-foreground md:py-24">
          <Container>
            <div className="mb-12 max-w-2xl">
              <Kanji className="text-current opacity-80">道のり</Kanji>
              <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">{journey.title}</h2>
            </div>
            <ol className="grid gap-6 md:grid-cols-4">
              {journey.steps.map((step, i) => (
                <li key={step.title} className="relative border-t border-current/25 pt-6">
                  <span className="font-display text-5xl font-semibold opacity-25">0{i + 1}</span>
                  <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed opacity-80">{step.text}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      ) : null}

      {/* Sourcing */}
      {sourcing ? (
        <Container className="py-20 md:py-28">
          <div className="relative overflow-hidden rounded-[2rem]">
            {sourcing.image ? <img src={sourcing.image} alt="" loading="lazy" className="h-[26rem] w-full object-cover md:h-[32rem]" /> : null}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-xl flex-col justify-center gap-4 p-8 text-white md:p-14">
              <span lang="ja" className="font-jp tracking-[0.35em] text-[#e9c98f]">産地</span>
              <h2 className="font-display text-3xl font-semibold md:text-4xl">{sourcing.title}</h2>
              <p className="leading-relaxed text-white/85">{sourcing.text}</p>
            </div>
            <Credit text={sourcing.imageCredit} />
          </div>
        </Container>
      ) : null}

      {/* Closing */}
      {closing ? (
        <Container className="pb-8 text-center">
          <p lang="ja" className="font-jp text-2xl tracking-[0.4em] text-primary">いただきます</p>
          <h2 className="mt-4 font-display text-3xl font-semibold md:text-4xl">{closing.title}</h2>
          <p className="mt-3 text-muted-foreground">{closing.text}</p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/menu">
              {t('home.ctaMenu')} <ArrowRight />
            </Link>
          </Button>
        </Container>
      ) : null}
    </>
  )
}
