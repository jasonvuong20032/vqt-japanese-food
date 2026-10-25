import { ArrowRight, ChefHat, Clock, Leaf, Search, ShieldCheck, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAbout, useBestSellers, useCatalog, useProducts, useStore } from '@/api/hooks'
import { Container, PageMeta } from '@/components/common'
import { ProductGrid, ProductRow } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/button'
import { Kanji, SectionHeading, Skeleton } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'
import { useUiStore } from '@/stores/ui'

function Hero() {
  const { t } = useTranslation()
  const f = useFormat()
  const { data: best } = useBestSellers(3)
  const { data: catalog } = useCatalog()
  const { data: store } = useStore()
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const dishCount = catalog?.reduce((sum, c) => sum + c.productCount, 0)
  const [main, second, third] = best ?? []

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[var(--hero-from)] to-[var(--hero-to)]">
      <div className="pattern-seigaiha pointer-events-none absolute inset-0" />
      <Container className="relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div className="animate-[rise_600ms_ease-out]">
          <p className="mb-5 flex flex-col items-start gap-1 text-sm font-medium text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
            <span className="font-jp text-base tracking-[0.35em] whitespace-nowrap text-primary" lang="ja">いらっしゃいませ</span>
            <span className="hidden h-px w-10 bg-border sm:block" />
            {t('home.eyebrow')}
          </p>
          <h1 className="font-display text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t('home.heroTitle')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">{t('home.heroSubtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/menu">
                {t('home.ctaMenu')} <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={() => setSearchOpen(true)} className="bg-background/70 backdrop-blur">
              <Search /> {t('home.ctaSearch')}
            </Button>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-border pt-6 sm:gap-4">
            <div>
              <dt className="text-xs text-muted-foreground">{t('home.statDishes')}</dt>
              <dd className="font-display text-lg font-semibold sm:text-2xl">{dishCount ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('home.statFreeShip')}</dt>
              <dd className="font-display text-lg font-semibold sm:text-2xl">{store ? f.money(store.info.freeShippingThreshold) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('home.statHours')}</dt>
              <dd className="font-display text-lg font-semibold sm:text-2xl">{store?.info.openingHours ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto aspect-[5/4] w-full max-w-xl lg:max-w-none">
          {main ? (
            <>
              <Link to={`/p/${main.product.slug}`} className="absolute inset-y-0 left-0 w-[68%] overflow-hidden rounded-[2rem] shadow-soft">
                <img src={main.product.imageUrl ?? ''} alt={main.product.name} className="size-full object-cover transition-transform duration-700 hover:scale-105" fetchPriority="high" />
                <span className="absolute bottom-4 left-4 rounded-2xl bg-background/90 px-4 py-2.5 shadow-soft backdrop-blur">
                  <span className="block text-[11px] font-semibold tracking-wide text-primary uppercase">#1 {t('home.bestSeller')}</span>
                  <span className="block max-w-[14rem] truncate font-display font-semibold">{main.product.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{f.money(main.product.effectivePrice)}</span>
                </span>
              </Link>
              {second ? (
                <Link to={`/p/${second.product.slug}`} className="absolute top-0 right-0 h-[47%] w-[29%] overflow-hidden rounded-3xl shadow-soft">
                  <img src={second.product.imageUrl ?? ''} alt={second.product.name} className="size-full object-cover transition-transform duration-700 hover:scale-105" />
                </Link>
              ) : null}
              {third ? (
                <Link to={`/p/${third.product.slug}`} className="absolute right-0 bottom-0 h-[49%] w-[29%] overflow-hidden rounded-3xl shadow-soft">
                  <img src={third.product.imageUrl ?? ''} alt={third.product.name} className="size-full object-cover transition-transform duration-700 hover:scale-105" />
                </Link>
              ) : null}
              <span className="absolute -top-4 left-[58%] grid size-24 place-items-center rounded-full bg-primary text-center text-primary-foreground shadow-soft">
                <span className="font-jp text-2xl leading-none" lang="ja">旬</span>
                <span className="-mt-3 text-[10px] font-semibold tracking-widest uppercase">{t('home.seasonal')}</span>
              </span>
            </>
          ) : (
            <Skeleton className="size-full rounded-[2rem]" />
          )}
        </div>
      </Container>
    </section>
  )
}

function CatalogShowcase() {
  const { t } = useTranslation()
  const { data: catalog, isLoading } = useCatalog()
  return (
    <Container className="py-16 md:py-24">
      <SectionHeading kanji="お品書き" title={t('home.categoriesTitle')} subtitle={t('home.categoriesSubtitle')} />
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-3xl md:aspect-[4/3]" />)
          : catalog?.map((c, i) => (
              <Link
                key={c.id}
                to={`/menu/${c.slug}`}
                className={`group relative block overflow-hidden rounded-3xl bg-muted ${i === 0 ? 'col-span-2 lg:row-span-2' : ''}`}
              >
                <div className={i === 0 ? 'aspect-[16/10] h-full lg:aspect-auto' : 'aspect-[4/5] md:aspect-[4/3]'}>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : null}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-6">
                  <span lang="ja" className="font-jp text-xs tracking-[0.35em] text-white/80 md:text-sm">{c.japaneseName}</span>
                  <h3 className={`mt-1 font-display font-semibold ${i === 0 ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl'}`}>{c.name}</h3>
                  <p className="mt-1 hidden text-sm text-white/80 md:line-clamp-2">{c.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                    {t('home.dishCount', { count: c.productCount })}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
      </div>
    </Container>
  )
}

function ChefSelection() {
  const { t } = useTranslation()
  const { data, isLoading } = useProducts({ tag: 'chef-choice', sort: 'price_desc', pageSize: 10 })
  return (
    <section className="relative overflow-hidden bg-[#0b0b0b] py-16 text-[#edeae4] md:py-24">
      <div className="pointer-events-none absolute -top-24 -right-24 font-jp text-[18rem] leading-none text-white/[0.04] select-none" aria-hidden>
        匠
      </div>
      <Container className="relative">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Kanji className="text-[#d6ae5c]">特選</Kanji>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">{t('home.chefTitle')}</h2>
            <p className="max-w-xl text-[#b9b3aa]">{t('home.chefSubtitle')}</p>
          </div>
          <Button variant="outline" asChild className="border-white/20 text-[#edeae4] hover:bg-white/10">
            <Link to="/menu?tag=premium&sort=price_desc">
              {t('home.viewPremium')} <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="[--background:#0b0b0b] [--card:#141414] [--card-foreground:#edeae4] [--foreground:#edeae4] [--muted:#1c1c1c] [--muted-foreground:#a29d95] [--border:#262626] [--primary:#d6ae5c] [--primary-foreground:#120e05] [--sale:#ff6b5b]">
          <ProductRow products={data?.items} loading={isLoading} />
        </div>
      </Container>
    </section>
  )
}

function StoryTeaser() {
  const { t } = useTranslation()
  const { data: about } = useAbout()
  if (!about?.story) return null
  return (
    <Container className="py-16 md:py-24">
      <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] border border-border bg-card md:grid-cols-2">
        <div className="relative h-72 md:h-full md:min-h-[26rem]">
          {about.story.image ? <img src={about.story.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : null}
        </div>
        <div className="space-y-4 p-8 md:p-12">
          <Kanji>物語</Kanji>
          <h2 className="font-display text-3xl font-semibold text-balance">{about.hero?.title ?? about.story.title}</h2>
          <p className="leading-relaxed text-muted-foreground">{about.story.paragraphs?.[0]}</p>
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
            {about.values?.map((v) => (
              <div key={v.kanji} className="rounded-2xl bg-muted p-3 text-center">
                <span lang="ja" className="block font-jp text-2xl text-primary">{v.kanji}</span>
                <span className="text-xs font-medium">{v.title}</span>
              </div>
            ))}
          </div>
          <Button variant="link" asChild className="text-base">
            <Link to="/about">
              {t('home.readStory')} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Container>
  )
}

function Promises() {
  const { t } = useTranslation()
  const items = [
    { icon: Leaf, title: t('home.promiseFresh'), text: t('home.promiseFreshText') },
    { icon: ChefHat, title: t('home.promiseCraft'), text: t('home.promiseCraftText') },
    { icon: Truck, title: t('home.promiseDelivery'), text: t('home.promiseDeliveryText') },
    { icon: ShieldCheck, title: t('home.promisePay'), text: t('home.promisePayText') },
  ]
  return (
    <Container className="pb-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4 rounded-3xl border border-border bg-card p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const { data: best, isLoading: loadingBest } = useBestSellers(10)
  const { data: deals, isLoading: loadingDeals } = useProducts({ onSale: true, inStock: true, sort: 'best_selling', pageSize: 8 })
  const { data: store } = useStore()

  return (
    <>
      <PageMeta />
      <Hero />
      <CatalogShowcase />

      <Container className="pb-16 md:pb-24">
        <SectionHeading
          kanji="人気"
          title={t('home.bestTitle')}
          subtitle={t('home.bestSubtitle')}
          action={
            <Button variant="outline" asChild>
              <Link to="/menu?sort=best_selling">
                {t('common.seeAll')} <ArrowRight />
              </Link>
            </Button>
          }
        />
        <ProductRow products={best?.map((b) => b.product)} loading={loadingBest} ranked />
      </Container>

      <ChefSelection />

      <Container className="py-16 md:py-24">
        <SectionHeading
          kanji="お得"
          title={t('home.dealsTitle')}
          subtitle={t('home.dealsSubtitle')}
          action={
            <Button variant="outline" asChild>
              <Link to="/menu?onSale=true">
                {t('common.seeAll')} <ArrowRight />
              </Link>
            </Button>
          }
        />
        <ProductGrid products={deals?.items} loading={loadingDeals} />
      </Container>

      <StoryTeaser />
      <Promises />

      {store ? (
        <Container className="pt-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-secondary px-6 py-6 text-secondary-foreground md:flex-row md:items-center md:px-10">
            <div className="flex items-center gap-4">
              <Clock className="size-8 shrink-0 opacity-80" />
              <div>
                <p className="font-display text-xl font-semibold">{t('home.trackTitle')}</p>
                <p className="text-sm opacity-80">{t('home.trackText')}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="border-current/30 bg-transparent text-current hover:bg-white/10">
              <Link to="/track">{t('nav.track')}</Link>
            </Button>
          </div>
        </Container>
      ) : null}
    </>
  )
}
