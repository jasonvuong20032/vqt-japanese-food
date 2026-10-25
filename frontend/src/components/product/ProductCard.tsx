import { ChevronLeft, ChevronRight, Plus, ShoppingBag } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { ProductCard as Product } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Badge, Skeleton } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/stores/cart'
import { useUiStore } from '@/stores/ui'
import { Price, RatingStars, WishlistButton } from './parts'

/** Tags that earn a visible badge on the card (the rest show on the product page). */
const BADGE_TAGS = ['premium', 'chef-choice', 'new', 'alcohol'] as const

export function useAddToCart() {
  const { t } = useTranslation()
  const add = useCartStore((s) => s.add)
  const setCartOpen = useUiStore((s) => s.setCartOpen)
  return (product: Product, quantity = 1) => {
    add(product, quantity)
    toast.success(t('cart.addedTitle', { name: product.name }), {
      description: t('cart.addedText', { count: quantity }),
      action: { label: t('cart.view'), onClick: () => setCartOpen(true) },
    })
  }
}

export function ProductCard({ product, rank, priority }: { product: Product; rank?: number; priority?: boolean }) {
  const { t } = useTranslation()
  const f = useFormat()
  const addToCart = useAddToCart()
  const badgeTag = BADGE_TAGS.find((tag) => product.tags.includes(tag))

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft">
      <Link to={`/p/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-muted" tabIndex={-1} aria-hidden>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={cn('size-full object-cover transition-transform duration-700 group-hover:scale-105', !product.inStock && 'grayscale-[60%]')}
          />
        ) : null}
        {!product.inStock ? (
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-semibold tracking-wide text-white uppercase">
            {t('product.soldOut')}
          </span>
        ) : null}
      </Link>

      <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
        {rank ? <Badge className="bg-foreground text-background">#{rank}</Badge> : null}
        {product.discountPercent > 0 ? <Badge variant="sale">-{product.discountPercent}%</Badge> : null}
        {badgeTag ? (
          <Badge className={badgeTag === 'alcohol' ? 'bg-black/70 text-white' : 'bg-background/85 text-foreground backdrop-blur'}>
            {t(`tags.${badgeTag}`)}
          </Badge>
        ) : null}
      </div>
      <WishlistButton productId={product.id} className="absolute top-3 right-3 z-10" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{product.categoryName}</p>
        <h3 className="font-display text-base leading-snug font-semibold text-balance md:text-[17px]">
          <Link to={`/p/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription ? (
          <p className="line-clamp-2 hidden text-sm text-muted-foreground sm:block">{product.shortDescription}</p>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {product.reviewCount > 0 ? (
            <span className="flex items-center gap-1">
              <RatingStars value={product.rating} size={12} />
              <span>({product.reviewCount})</span>
            </span>
          ) : null}
          {product.soldCount > 0 ? <span>{t('product.soldCount', { count: product.soldCount, value: f.compact(product.soldCount) })}</span> : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price price={product.price} effectivePrice={product.effectivePrice} />
          <Button
            size="icon-sm"
            className="relative z-10 size-10 sm:w-auto sm:px-4"
            onClick={() => addToCart(product)}
            disabled={!product.inStock}
            aria-label={t('product.addNamed', { name: product.name })}
          >
            <Plus className="sm:hidden" />
            <ShoppingBag className="hidden sm:block" />
            <span className="hidden sm:inline">{t('product.add')}</span>
          </Button>
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="size-10 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function ProductGrid({
  products,
  loading,
  skeletons = 8,
  className,
}: {
  products?: Product[]
  loading?: boolean
  skeletons?: number
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {loading && !products
        ? Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={i} />)
        : products?.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
    </div>
  )
}

/** Horizontal, swipeable row with arrow buttons on desktop. */
export function ProductRow({ products, loading, ranked }: { products?: Product[]; loading?: boolean; ranked?: boolean }) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <div className="relative">
      <div ref={scroller} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 md:mx-0 md:px-0">
        {loading && !products
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-[23.5%]">
                <ProductCardSkeleton />
              </div>
            ))
          : products?.map((p, i) => (
              <div key={p.id} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-[23.5%]">
                <ProductCard product={p} rank={ranked ? i + 1 : undefined} priority={i < 3} />
              </div>
            ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 -right-3 -left-3 hidden items-center justify-between lg:flex">
        <Button variant="outline" size="icon" className="pointer-events-auto bg-background/90 backdrop-blur" onClick={() => scroll(-1)} aria-label={t('common.previous')}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" className="pointer-events-auto bg-background/90 backdrop-blur" onClick={() => scroll(1)} aria-label={t('common.next')}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
