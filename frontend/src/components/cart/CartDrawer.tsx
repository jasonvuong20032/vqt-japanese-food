import { ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCartQuote } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { Sheet, SheetContent } from '@/components/ui/overlay'
import { useCartCount, useCartStore } from '@/stores/cart'
import { useUiStore } from '@/stores/ui'
import { CartLineRow, FreeShippingProgress, Totals } from './CartParts'

export function CartDrawer() {
  const { t } = useTranslation()
  const open = useUiStore((s) => s.cartOpen)
  const setOpen = useUiStore((s) => s.setCartOpen)
  const items = useCartStore((s) => s.items)
  const count = useCartCount()
  const { data: quote } = useCartQuote()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent title={t('cart.title')} description={count > 0 ? t('cart.itemCount', { count }) : undefined} closeLabel={t('common.close')}>
        {items.length === 0 ? (
          <EmptyState
            className="flex-1"
            icon={<ShoppingBag />}
            title={t('cart.empty')}
            text={t('cart.emptyHint')}
            action={
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/menu">{t('cart.browseMenu')}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              {quote ? (
                <div className="pt-4">
                  <FreeShippingProgress quote={quote} />
                </div>
              ) : null}
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <CartLineRow key={item.productId} item={item} line={quote?.lines.find((l) => l.productId === item.productId)} compact />
                ))}
              </ul>
            </div>
            <div className="space-y-4 border-t border-border bg-card px-5 py-5">
              {quote ? <Totals quote={quote} /> : null}
              <div className="grid gap-2">
                <Button size="lg" asChild onClick={() => setOpen(false)} className={!quote?.canCheckout ? 'pointer-events-none opacity-50' : ''}>
                  <Link to="/checkout" aria-disabled={!quote?.canCheckout}>
                    {t('cart.checkout')}
                  </Link>
                </Button>
                <Button variant="ghost" asChild onClick={() => setOpen(false)}>
                  <Link to="/cart">{t('cart.viewFull')}</Link>
                </Button>
              </div>
              {quote && !quote.canCheckout ? <p className="text-center text-xs text-sale">{t('cart.fixProblems')}</p> : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
