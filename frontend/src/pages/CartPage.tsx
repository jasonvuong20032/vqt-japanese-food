import { ArrowRight, ShieldCheck, ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useBestSellers, useCartQuote } from '@/api/hooks'
import { CartLineRow, CouponForm, FreeShippingProgress, Totals } from '@/components/cart/CartParts'
import { Container, PageMeta } from '@/components/common'
import { ProductRow } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/button'
import { EmptyState, SectionHeading, Skeleton } from '@/components/ui/misc'
import { useCartCount, useCartStore } from '@/stores/cart'

export default function CartPage() {
  const { t } = useTranslation()
  const items = useCartStore((s) => s.items)
  const clear = useCartStore((s) => s.clear)
  const count = useCartCount()
  const { data: quote } = useCartQuote()
  const { data: best } = useBestSellers(10)

  return (
    <>
      <PageMeta title={t('cart.title')} />
      <Container className="py-8 md:py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('cart.title')}</h1>
        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag />}
            title={t('cart.empty')}
            text={t('cart.emptyHint')}
            action={
              <Button asChild>
                <Link to="/menu">{t('cart.browseMenu')}</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <section className="rounded-3xl border border-border bg-card px-5 md:px-7">
              <div className="flex items-center justify-between border-b border-border py-4">
                <p className="text-sm text-muted-foreground">{t('cart.itemCount', { count })}</p>
                <button onClick={clear} className="text-sm text-muted-foreground hover:text-sale">
                  {t('cart.clear')}
                </button>
              </div>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <CartLineRow key={item.productId} item={item} line={quote?.lines.find((l) => l.productId === item.productId)} />
                ))}
              </ul>
            </section>

            <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              {quote ? <FreeShippingProgress quote={quote} /> : null}
              <div className="space-y-5 rounded-3xl border border-border bg-card p-6">
                <h2 className="font-display text-xl font-semibold">{t('cart.summary')}</h2>
                <CouponForm quote={quote} />
                {quote ? <Totals quote={quote} /> : <Skeleton className="h-32" />}
                <Button size="lg" className="w-full" asChild disabled={!quote?.canCheckout}>
                  <Link to="/checkout" className={!quote?.canCheckout ? 'pointer-events-none opacity-50' : ''}>
                    {t('cart.checkout')} <ArrowRight />
                  </Link>
                </Button>
                {quote && !quote.canCheckout ? <p className="text-center text-xs text-sale">{t('cart.fixProblems')}</p> : null}
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4" /> {t('cart.secure')}
                </p>
              </div>
            </aside>
          </div>
        )}

        <div className="mt-20">
          <SectionHeading kanji="人気" title={t('cart.youMayLike')} />
          <ProductRow products={best?.map((b) => b.product).filter((p) => !items.some((i) => i.productId === p.id))} />
        </div>
      </Container>
    </>
  )
}
