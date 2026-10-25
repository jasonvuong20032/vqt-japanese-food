import { ArrowRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { useCatalog, useProducts } from '@/api/hooks'
import type { CatalogNode, ProductQuery } from '@/api/types'
import { Breadcrumbs, Container, ErrorState, PageMeta, Pagination } from '@/components/common'
import { rememberSearch } from '@/components/layout/SearchPalette'
import { ProductGrid } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Select } from '@/components/ui/form'
import { EmptyState, Kanji, Skeleton } from '@/components/ui/misc'
import { Sheet, SheetContent } from '@/components/ui/overlay'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'

const FILTER_TAGS = ['premium', 'chef-choice', 'new', 'raw', 'grilled', 'seafood', 'beef', 'spicy', 'vegetarian', 'matcha', 'sweet', 'alcohol', 'sharing'] as const
const PRICE_PRESETS: [number | undefined, number | undefined][] = [
  [undefined, 100_000],
  [100_000, 200_000],
  [200_000, 500_000],
  [500_000, undefined],
]

function readQuery(params: URLSearchParams, catalogId?: number): ProductQuery {
  const num = (k: string) => {
    const v = Number(params.get(k))
    return params.get(k) && Number.isFinite(v) ? v : undefined
  }
  return {
    search: params.get('q') ?? undefined,
    catalogId,
    categoryId: num('category'),
    minPrice: num('min'),
    maxPrice: num('max'),
    tag: params.get('tag') ?? undefined,
    onSale: params.get('onSale') === 'true' || undefined,
    inStock: params.get('inStock') === 'true' || undefined,
    sort: params.get('sort') ?? undefined,
    page: num('page') ?? 1,
    pageSize: 24,
  }
}

export default function MenuPage() {
  const { catalogSlug } = useParams()
  const [params] = useSearchParams()
  const { data: catalog, isLoading } = useCatalog()
  const current = catalog?.find((c) => c.slug === catalogSlug)
  const filtering = ['q', 'sort', 'min', 'max', 'tag', 'onSale', 'inStock', 'page'].some((k) => params.has(k))

  if (isLoading || !catalog) {
    return (
      <Container className="py-10">
        <Skeleton className="h-56 rounded-3xl" />
        <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
        </div>
      </Container>
    )
  }

  if (catalogSlug && !current) {
    return (
      <Container>
        <EmptyState title={'404'} action={<Button asChild><Link to="/menu">←</Link></Button>} />
      </Container>
    )
  }

  return filtering ? <ResultsView catalog={catalog} current={current} /> : <BrowseView catalog={catalog} current={current} />
}

// ====================================================================== browse ("menu book") view

function MenuHero({ current, totalCount }: { current?: CatalogNode; totalCount: number }) {
  const { t } = useTranslation()
  return (
    <section className="relative isolate overflow-hidden bg-[#0d0b09] text-white">
      {current?.imageUrl ? <img src={current.imageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-55" /> : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
      {!current ? <div className="pattern-seigaiha absolute inset-0 -z-10 opacity-40 [--pattern:rgb(255_255_255/0.08)]" /> : null}
      <Container className="py-14 md:py-20">
        <Breadcrumbs
          className="mb-6 text-white/70 [&_a:hover]:text-white [&_span]:text-white"
          items={current ? [{ label: t('nav.menu'), to: '/menu' }, { label: current.name }] : [{ label: t('nav.menu') }]}
        />
        <span lang="ja" className="font-jp text-lg tracking-[0.4em] text-[#e9c98f]">{current?.japaneseName ?? 'お品書き'}</span>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-6xl">{current?.name ?? t('menu.title')}</h1>
        <p className="mt-4 max-w-2xl text-white/80 md:text-lg">{current?.description ?? t('menu.subtitle')}</p>
        <p className="mt-6 text-sm font-semibold tracking-[0.2em] text-white/70 uppercase">
          {t('home.dishCount', { count: current?.productCount ?? totalCount })}
        </p>
      </Container>
    </section>
  )
}

interface SectionDef {
  id: string
  name: string
  japaneseName: string | null
  description: string | null
  count: number
  query: ProductQuery
  link?: string
}

function BrowseView({ catalog, current }: { catalog: CatalogNode[]; current?: CatalogNode }) {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const tabsRef = useRef<HTMLDivElement>(null)
  const totalCount = catalog.reduce((s, c) => s + c.productCount, 0)

  const sections: SectionDef[] = useMemo(
    () =>
      current
        ? current.categories.map((c) => ({
            id: `cat-${c.id}`,
            name: c.name,
            japaneseName: c.japaneseName,
            description: c.description,
            count: c.productCount,
            query: { categoryId: c.id, sort: 'best_selling', pageSize: 60 },
          }))
        : catalog.map((c) => ({
            id: `catalog-${c.id}`,
            name: c.name,
            japaneseName: c.japaneseName,
            description: c.description,
            count: c.productCount,
            query: { catalogId: c.id, sort: 'best_selling', pageSize: 8 },
            link: `/menu/${c.slug}`,
          })),
    [catalog, current],
  )

  const [active, setActive] = useState(sections[0]?.id)

  // Scroll-spy: highlight the tab of the section currently under the sticky bar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-150px 0px -55% 0px' },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${active}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  // Deep link: /menu/sushi-sashimi?category=7 jumps to that section
  useEffect(() => {
    const category = params.get('category')
    if (!category) return
    const id = setTimeout(() => document.getElementById(`cat-${category}`)?.scrollIntoView({ behavior: 'smooth' }), 350)
    return () => clearTimeout(id)
  }, [params])

  return (
    <>
      <PageMeta title={current?.name ?? t('menu.title')} description={current?.description ?? t('menu.subtitle')} image={current?.imageUrl} />
      <MenuHero current={current} totalCount={totalCount} />

      <div className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur-xl md:top-[72px]">
        <Container className="flex items-center gap-3">
          <div ref={tabsRef} className="scrollbar-none flex flex-1 gap-1 overflow-x-auto py-3" role="tablist" aria-label={t('menu.sections')}>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                data-tab={s.id}
                role="tab"
                aria-selected={active === s.id}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {s.name}
                <span className={cn('text-xs', active === s.id ? 'opacity-80' : 'opacity-60')}>{s.count}</span>
              </a>
            ))}
          </div>
          <Button variant="outline" size="sm" asChild className="hidden shrink-0 md:inline-flex">
            <Link to={`${current ? `/menu/${current.slug}` : '/menu'}?sort=best_selling`}>
              <SlidersHorizontal /> {t('menu.filterSort')}
            </Link>
          </Button>
        </Container>
      </div>

      <Container className="space-y-20 py-12 md:py-16">
        {sections.map((s) => (
          <MenuSection key={s.id} section={s} />
        ))}
      </Container>
    </>
  )
}

function MenuSection({ section }: { section: SectionDef }) {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useProducts(section.query)
  return (
    <section id={section.id} className="scroll-mt-40" aria-labelledby={`${section.id}-title`}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-end gap-5">
          {section.japaneseName ? (
            <span lang="ja" aria-hidden className="hidden font-jp text-5xl leading-none text-primary/80 [writing-mode:vertical-rl] md:block">
              {section.japaneseName.split('・')[0]}
            </span>
          ) : null}
          <div className="space-y-1.5">
            <Kanji className="md:hidden">{section.japaneseName}</Kanji>
            <h2 id={`${section.id}-title`} className="font-display text-3xl font-semibold tracking-tight">{section.name}</h2>
            {section.description ? <p className="max-w-2xl text-muted-foreground">{section.description}</p> : null}
          </div>
        </div>
        {section.link ? (
          <Button variant="outline" asChild>
            <Link to={section.link}>
              {t('menu.viewSection', { count: section.count })} <ArrowRight />
            </Link>
          </Button>
        ) : null}
      </div>
      {isError ? <ErrorState onRetry={() => void refetch()} /> : <ProductGrid products={data?.items} loading={isLoading} skeletons={4} />}
    </section>
  )
}

// ====================================================================== search / filter view

function useQueryUpdater() {
  const [params, setParams] = useSearchParams()
  return (changes: Record<string, string | number | boolean | undefined | null>, keepPage = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === null || v === '' || v === false) next.delete(k)
      else next.set(k, String(v))
    }
    if (!keepPage) next.delete('page')
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function Filters({ catalog, current, query }: { catalog: CatalogNode[]; current?: CatalogNode; query: ProductQuery }) {
  const { t } = useTranslation()
  const f = useFormat()
  const update = useQueryUpdater()
  const [params] = useSearchParams()
  const [min, setMin] = useState(query.minPrice?.toString() ?? '')
  const [max, setMax] = useState(query.maxPrice?.toString() ?? '')
  useEffect(() => {
    setMin(query.minPrice?.toString() ?? '')
    setMax(query.maxPrice?.toString() ?? '')
  }, [query.minPrice, query.maxPrice])

  const keep = (extra: string) => {
    const next = new URLSearchParams(params)
    next.delete('category')
    next.delete('page')
    return `${extra}${next.toString() ? `?${next}` : ''}`
  }

  const applyPrice = (e: FormEvent) => {
    e.preventDefault()
    update({ min: min || undefined, max: max || undefined })
  }

  const presetLabel = ([lo, hi]: [number | undefined, number | undefined]) =>
    lo === undefined ? t('menu.under', { amount: f.compact(hi!) }) : hi === undefined ? t('menu.over', { amount: f.compact(lo) }) : `${f.compact(lo)} – ${f.compact(hi)}`

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">{t('menu.categories')}</h3>
        <ul className="space-y-1 text-sm">
          <li>
            <Link to={keep('/menu')} className={cn('block rounded-xl px-3 py-2 hover:bg-muted', !current && 'bg-muted font-semibold')}>
              {t('menu.all')}
            </Link>
          </li>
          {catalog.map((c) => (
            <li key={c.id}>
              <Link to={keep(`/menu/${c.slug}`)} className={cn('flex justify-between rounded-xl px-3 py-2 hover:bg-muted', current?.id === c.id && !query.categoryId && 'bg-muted font-semibold')}>
                <span>{c.name}</span>
                <span className="text-muted-foreground">{c.productCount}</span>
              </Link>
              {current?.id === c.id ? (
                <ul className="mt-1 ml-3 space-y-0.5 border-l border-border pl-3">
                  {c.categories.map((x) => (
                    <li key={x.id}>
                      <button
                        onClick={() => update({ category: query.categoryId === x.id ? undefined : x.id })}
                        className={cn('flex w-full justify-between rounded-lg px-2 py-1.5 text-left hover:bg-muted', query.categoryId === x.id && 'font-semibold text-primary')}
                      >
                        <span>{x.name}</span>
                        <span className="text-muted-foreground">{x.productCount}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">{t('menu.price')}</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRICE_PRESETS.map((preset) => {
            const selected = query.minPrice === preset[0] && query.maxPrice === preset[1]
            return (
              <button
                key={presetLabel(preset)}
                onClick={() => update(selected ? { min: undefined, max: undefined } : { min: preset[0], max: preset[1] })}
                className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50')}
              >
                {presetLabel(preset)}
              </button>
            )
          })}
        </div>
        <form onSubmit={applyPrice} className="flex items-center gap-2">
          <Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder={t('menu.min')} aria-label={t('menu.min')} className="h-9 px-3" />
          <span className="text-muted-foreground">–</span>
          <Input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} placeholder={t('menu.max')} aria-label={t('menu.max')} className="h-9 px-3" />
          <Button size="sm" variant="outline" type="submit">
            {t('menu.go')}
          </Button>
        </form>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">{t('menu.tags')}</h3>
        <div className="flex flex-wrap gap-2">
          {FILTER_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => update({ tag: query.tag === tag ? undefined : tag })}
              aria-pressed={query.tag === tag}
              className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', query.tag === tag ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50')}
            >
              {t(`tags.${tag}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox checked={!!query.onSale} onChange={(e) => update({ onSale: e.target.checked })} />
          {t('menu.onSale')}
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox checked={!!query.inStock} onChange={(e) => update({ inStock: e.target.checked })} />
          {t('menu.inStock')}
        </label>
      </div>
    </div>
  )
}

function ResultsView({ catalog, current }: { catalog: CatalogNode[]; current?: CatalogNode }) {
  const { t } = useTranslation()
  const f = useFormat()
  const [params] = useSearchParams()
  const update = useQueryUpdater()
  const query = useMemo(() => readQuery(params, current?.id), [params, current?.id])
  const { data, isLoading, isError, isFetching, refetch } = useProducts(query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState(query.search ?? '')
  useEffect(() => setSearch(query.search ?? ''), [query.search])

  const category = current?.categories.find((c) => c.id === query.categoryId)
  const title = query.search ? t('menu.resultsFor', { query: query.search }) : (category?.name ?? current?.name ?? t('menu.title'))
  const sort = query.sort ?? (query.search ? 'relevance' : 'newest')

  const chips: { label: string; clear: Record<string, undefined> }[] = []
  if (query.search) chips.push({ label: `“${query.search}”`, clear: { q: undefined } })
  if (category) chips.push({ label: category.name, clear: { category: undefined } as Record<string, undefined> })
  if (query.minPrice !== undefined || query.maxPrice !== undefined)
    chips.push({ label: `${query.minPrice !== undefined ? f.money(query.minPrice) : '0'} – ${query.maxPrice !== undefined ? f.money(query.maxPrice) : '∞'}`, clear: { min: undefined, max: undefined } })
  if (query.tag) chips.push({ label: t(`tags.${query.tag}`), clear: { tag: undefined } })
  if (query.onSale) chips.push({ label: t('menu.onSale'), clear: { onSale: undefined } })
  if (query.inStock) chips.push({ label: t('menu.inStock'), clear: { inStock: undefined } })

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    rememberSearch(search)
    update({ q: search.trim() || undefined })
  }

  return (
    <>
      <PageMeta title={title} />
      <Container className="py-8 md:py-10">
        <Breadcrumbs
          items={[
            { label: t('nav.menu'), to: '/menu' },
            ...(current ? [{ label: current.name, to: `/menu/${current.slug}` }] : []),
            ...(query.search ? [{ label: t('nav.search') }] : category ? [{ label: category.name }] : []),
          ]}
        />
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          <form onSubmit={submitSearch} className="relative w-full md:w-80">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search.short')} aria-label={t('nav.search')} className="rounded-full pl-10" />
          </form>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block" aria-label={t('menu.filters')}>
            <div className="sticky top-28">
              <Filters catalog={catalog} current={current} query={query} />
            </div>
          </aside>

          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {data ? t('menu.resultCount', { count: data.totalItems }) : ' '}
                {isFetching && data ? <span className="ml-2 opacity-60">…</span> : null}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                  <SlidersHorizontal /> {t('menu.filters')}
                </Button>
                <label className="sr-only" htmlFor="sort">{t('menu.sortBy')}</label>
                <Select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value })} className="h-9 w-auto rounded-full pr-9 pl-4 text-sm">
                  {query.search ? <option value="relevance">{t('menu.sort.relevance')}</option> : null}
                  <option value="best_selling">{t('menu.sort.best_selling')}</option>
                  <option value="newest">{t('menu.sort.newest')}</option>
                  <option value="price_asc">{t('menu.sort.price_asc')}</option>
                  <option value="price_desc">{t('menu.sort.price_desc')}</option>
                  <option value="name">{t('menu.sort.name')}</option>
                </Select>
              </div>
            </div>

            {chips.length ? (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <button key={chip.label} onClick={() => update(chip.clear)} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    {chip.label} <X className="size-3.5" />
                  </button>
                ))}
                <Link to={current ? `/menu/${current.slug}` : '/menu'} className="text-xs font-medium text-primary hover:underline">
                  {t('menu.clearAll')}
                </Link>
              </div>
            ) : null}

            {isError ? (
              <ErrorState onRetry={() => void refetch()} />
            ) : data && data.items.length === 0 ? (
              <EmptyState
                icon={<Search />}
                title={query.search ? t('search.noResults', { query: query.search }) : t('menu.noResults')}
                text={t('search.noResultsHint')}
                action={
                  <Button asChild variant="outline">
                    <Link to="/menu">{t('menu.backToMenu')}</Link>
                  </Button>
                }
              />
            ) : (
              <div className={cn('transition-opacity', isFetching && data && 'opacity-60')}>
                <ProductGrid products={data?.items} loading={isLoading} className="lg:grid-cols-3" />
              </div>
            )}

            {data ? <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => update({ page }, true)} /> : null}
          </div>
        </div>
      </Container>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" title={t('menu.filters')} closeLabel={t('common.close')} className="max-w-sm">
          <div className="flex-1 overflow-y-auto p-5">
            <Filters catalog={catalog} current={current} query={query} />
          </div>
          <div className="border-t border-border p-4">
            <Button className="w-full" onClick={() => setFiltersOpen(false)}>
              {data ? t('menu.showResults', { count: data.totalItems }) : t('common.close')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
