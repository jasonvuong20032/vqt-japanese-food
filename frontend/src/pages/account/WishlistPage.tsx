import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useWishlist } from '@/api/hooks'
import { ErrorState } from '@/components/common'
import { ProductGrid } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'

export default function WishlistPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useWishlist()
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (data && data.length === 0) {
    return (
      <EmptyState
        icon={<Heart />}
        title={t('wishlist.empty')}
        text={t('wishlist.emptyHint')}
        action={<Button asChild><Link to="/menu">{t('cart.browseMenu')}</Link></Button>}
        className="rounded-3xl border border-border bg-card"
      />
    )
  }
  return (
    <div>
      <h2 className="mb-5 font-display text-xl font-semibold">{t('nav.wishlist')}</h2>
      <ProductGrid products={data} loading={isLoading} className="xl:grid-cols-3" />
    </div>
  )
}
