import { BadgeCheck, CircleAlert, Clock, MessageSquareText, ShieldCheck, ShoppingBag, Truck, Zap } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { recordProductView, useCatalog, useCreateReview, useMe, useProduct, useRelated, useReviewEligibility, useReviews, useStore } from '@/api/hooks'
import type { ProductDetail } from '@/api/types'
import { Breadcrumbs, Container, ErrorState, PageMeta, Pagination } from '@/components/common'
import { ProductRow, useAddToCart } from '@/components/product/ProductCard'
import { Price, QuantityStepper, RatingStars, WishlistButton } from '@/components/product/parts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/form'
import { Badge, EmptyState, SectionHeading, Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/stores/cart'

function Gallery({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const images = product.images.length ? product.images : product.card.imageUrl ? [{ id: 0, url: product.card.imageUrl, alt: product.card.name, credit: null }] : []
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [product.card.id])
  const current = images[index]

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
        {current ? <img key={current.url} src={current.url} alt={current.alt ?? product.card.name} className="size-full animate-[fade-in_300ms] object-cover" fetchPriority="high" /> : null}
        {product.card.discountPercent > 0 ? <Badge variant="sale" className="absolute top-4 left-4 px-3 py-1 text-sm">-{product.card.discountPercent}%</Badge> : null}
        <WishlistButton productId={product.card.id} className="absolute top-4 right-4 size-11" />
      </div>
      {current?.credit ? (
        <p className="text-[11px] text-muted-foreground">
          {t('product.photoCredit')}: {current.credit.split(' · ').slice(0, 2).join(' · ')}{' '}
          <Link to="/credits" className="underline underline-offset-2">{t('product.details')}</Link>
        </p>
      ) : null}
      {images.length > 1 ? (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setIndex(i)}
              aria-label={t('product.photo', { index: i + 1 })}
              aria-current={i === index}
              className={cn('size-20 shrink-0 overflow-hidden rounded-2xl border-2 transition', i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <img src={img.url} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ReviewsSection({ productId }: { productId: number }) {
  const { t } = useTranslation()
  const f = useFormat()
  const [page, setPage] = useState(1)
  const { data: me } = useMe()
  const { data } = useReviews(productId, page)
  const { data: eligibility } = useReviewEligibility(productId, !!me)
  const create = useCreateReview(productId)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('reviews.thanks'))
          setComment('')
        },
        onError: (error) => toast.error(errorMessage(t, error)),
      },
    )
  }

  const summary = data?.summary
  return (
    <section id="reviews" className="scroll-mt-28">
      <SectionHeading kanji="評価" title={t('reviews.title')} />
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-display text-5xl font-semibold">{summary && summary.count ? summary.average.toFixed(1) : '—'}</p>
          <RatingStars value={summary?.average ?? 0} size={18} className="mt-2" />
          <p className="mt-1 text-sm text-muted-foreground">{t('reviews.count', { count: summary?.count ?? 0 })}</p>
          <div className="mt-5 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary?.distribution[star] ?? 0
              const pct = summary?.count ? (n / summary.count) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums">{star}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-star" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted-foreground tabular-nums">{n}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          {eligibility?.canReview ? (
            <form onSubmit={submit} className="space-y-3 rounded-3xl border border-primary/30 bg-primary/5 p-5">
              <p className="font-semibold">{t('reviews.write')}</p>
              <div className="flex gap-1" role="radiogroup" aria-label={t('reviews.rating')}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" role="radio" aria-checked={rating === star} onClick={() => setRating(star)} aria-label={`${star}`}>
                    <RatingStars value={star <= rating ? 1 : 0} size={28} className="[&>span:not(:first-child)]:hidden" />
                  </button>
                ))}
              </div>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('reviews.placeholder')} maxLength={2000} />
              <Button type="submit" loading={create.isPending}>{t('reviews.submit')}</Button>
            </form>
          ) : !me ? (
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:underline">{t('nav.login')}</Link> — {t('reviews.onlyBuyers')}
            </p>
          ) : null}

          {data && data.reviews.items.length === 0 ? (
            <EmptyState icon={<MessageSquareText />} title={t('reviews.none')} text={t('reviews.beFirst')} className="py-8" />
          ) : (
            <ul className="space-y-4">
              {data?.reviews.items.map((r) => (
                <li key={r.id} className="rounded-3xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-muted text-sm font-semibold">{r.authorName.slice(-1)}</span>
                      <div>
                        <p className="text-sm font-semibold">{r.authorName}</p>
                        <RatingStars value={r.rating} size={13} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {r.verifiedPurchase ? (
                        <span className="flex items-center gap-1 text-success">
                          <BadgeCheck className="size-3.5" /> {t('reviews.verified')}
                        </span>
                      ) : null}
                      {f.date(r.createdAt)}
                    </div>
                  </div>
                  {r.comment ? <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
          {data ? <Pagination page={data.reviews.page} totalPages={data.reviews.totalPages} onChange={setPage} /> : null}
        </div>
      </div>
    </section>
  )
}

export default function ProductPage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const f = useFormat()
  const navigate = useNavigate()
  const { data: product, isLoading, isError, error, refetch } = useProduct(slug)
  const { data: related, isLoading: loadingRelated } = useRelated(product?.card.id)
  const { data: catalog } = useCatalog()
  const { data: store } = useStore()
  const addToCart = useAddToCart()
  const add = useCartStore((s) => s.add)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    setQuantity(1)
    if (product) recordProductView(product.card.id)
  }, [product?.card.id])

  if (isLoading) {
    return (
      <Container className="grid gap-10 py-10 lg:grid-cols-2">
        <Skeleton className="aspect-[4/3] rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </Container>
    )
  }

  if (isError || !product) {
    const notFound = (error as { status?: number } | null)?.status === 404
    return (
      <Container className="py-10">
        {notFound ? (
          <EmptyState title={t('product.notFound')} text={t('product.notFoundText')} action={<Button asChild><Link to="/menu">{t('menu.backToMenu')}</Link></Button>} />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </Container>
    )
  }

  const card = product.card
  const catalogNode = catalog?.find((c) => c.id === product.catalogId)
  const isAlcohol = card.tags.includes('alcohol')
  const lowStock = card.inStock && card.stock <= 10

  const buyNow = () => {
    add(card, quantity)
    navigate('/checkout')
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: card.name,
    image: product.images.map((i) => new URL(i.url, window.location.origin).toString()),
    description: card.shortDescription ?? undefined,
    sku: card.code,
    category: card.categoryName,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'VND',
      price: card.effectivePrice,
      availability: card.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: window.location.href,
    },
    ...(card.reviewCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: card.rating, reviewCount: card.reviewCount } } : {}),
  }

  return (
    <>
      <PageMeta title={product.metaTitle ?? card.name} description={product.metaDescription ?? card.shortDescription} image={card.imageUrl} />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      <Container className="py-6 md:py-10">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: t('nav.menu'), to: '/menu' },
            ...(catalogNode ? [{ label: catalogNode.name, to: `/menu/${catalogNode.slug}` }] : []),
            ...(catalogNode ? [{ label: card.categoryName, to: `/menu/${catalogNode.slug}?category=${card.categoryId}` }] : []),
            { label: card.name },
          ]}
        />

        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <Gallery product={product} />

          <div className="lg:pt-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">{card.categoryName}</p>
            <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">{card.name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {card.reviewCount > 0 ? (
                <a href="#reviews" className="flex items-center gap-1.5 hover:text-foreground">
                  <RatingStars value={card.rating} /> {t('reviews.count', { count: card.reviewCount })}
                </a>
              ) : null}
              {card.soldCount > 0 ? <span>{t('product.soldCount', { count: card.soldCount, value: f.number(card.soldCount) })}</span> : null}
              <span className="text-xs">{t('product.code')}: {card.code}</span>
            </div>

            <Price price={card.price} effectivePrice={card.effectivePrice} size="lg" className="mt-6" />
            {card.discountPercent > 0 ? (
              <p className="mt-1 text-sm font-medium text-sale">{t('product.youSave', { amount: f.money(card.price - card.effectivePrice) })}</p>
            ) : null}

            {card.shortDescription ? <p className="mt-5 leading-relaxed text-muted-foreground">{card.shortDescription}</p> : null}

            {card.tags.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <Link key={tag} to={`/menu?tag=${tag}`} className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary">
                    {t(`tags.${tag}`)}
                  </Link>
                ))}
              </div>
            ) : null}

            {isAlcohol ? (
              <p className="mt-5 flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" /> {t('product.alcoholNotice')}
              </p>
            ) : null}

            <div className="mt-6">
              <p className={cn('mb-3 text-sm font-medium', card.inStock ? (lowStock ? 'text-warning' : 'text-success') : 'text-sale')}>
                {card.inStock ? (lowStock ? t('product.lowStock', { count: card.stock }) : t('product.inStock')) : t('product.soldOut')}
              </p>
              <div className="hidden flex-wrap items-center gap-3 sm:flex">
                <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, Math.min(99, card.stock))} label={t('product.quantity')} />
                <Button size="lg" className="flex-1" disabled={!card.inStock} onClick={() => addToCart(card, quantity)}>
                  <ShoppingBag /> {t('product.addToCart')}
                </Button>
                <Button size="lg" variant="secondary" disabled={!card.inStock} onClick={buyNow}>
                  <Zap /> {t('product.buyNow')}
                </Button>
              </div>
            </div>

            <ul className="mt-8 grid gap-3 rounded-3xl border border-border bg-card p-5 text-sm">
              <li className="flex gap-3">
                <Truck className="size-5 shrink-0 text-primary" />
                {store ? t('product.deliveryInfo', { amount: f.money(store.info.freeShippingThreshold) }) : null}
              </li>
              <li className="flex gap-3">
                <Clock className="size-5 shrink-0 text-primary" /> {t('product.deliveryTime')}
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="size-5 shrink-0 text-primary" /> {t('product.payInfo')}
              </li>
            </ul>
          </div>
        </div>

        {product.description ? (
          <section className="mt-16 max-w-3xl">
            <SectionHeading kanji="詳細" title={t('product.description')} />
            <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</p>
          </section>
        ) : null}

        <div className="mt-16 md:mt-24">
          <SectionHeading kanji="おすすめ" title={t('product.related')} subtitle={t('product.relatedSubtitle')} />
          <ProductRow products={related} loading={loadingRelated} />
        </div>

        <div className="mt-16 md:mt-24">
          <ReviewsSection productId={card.id} />
        </div>
      </Container>

      {/* Mobile: purchase bar always within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <QuantityStepper size="sm" value={quantity} onChange={setQuantity} max={Math.max(1, Math.min(99, card.stock))} label={t('product.quantity')} />
        <Button className="flex-1" disabled={!card.inStock} onClick={() => addToCart(card, quantity)}>
          <ShoppingBag /> {f.money(card.effectivePrice * quantity)}
        </Button>
      </div>
      <div className="h-20 sm:hidden" />
    </>
  )
}
