import { Heart, KeyRound, LogOut, MapPin, Package, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useLogout, useMe } from '@/api/hooks'
import { Container, PageMeta } from '@/components/common'
import { Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

export default function AccountLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: me, isLoading } = useMe()
  const logout = useLogout()

  if (isLoading) return <Container className="py-10"><Skeleton className="h-96 rounded-3xl" /></Container>
  if (!me) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />

  const links = [
    { to: '/account', end: true, icon: User, label: t('account.profile') },
    { to: '/account/orders', icon: Package, label: t('nav.orders') },
    { to: '/account/addresses', icon: MapPin, label: t('account.addresses') },
    { to: '/account/wishlist', icon: Heart, label: t('nav.wishlist') },
    { to: '/account/security', icon: KeyRound, label: t('account.security') },
  ]

  return (
    <>
      <PageMeta title={t('nav.account')} />
      <Container className="py-8 md:py-12">
        <div className="mb-8 flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-primary font-display text-xl font-semibold text-primary-foreground">
            {me.fullName.trim().split(' ').pop()?.[0]?.toUpperCase()}
          </span>
          <div>
            <p className="text-sm text-muted-foreground">{t('account.hello')}</p>
            <h1 className="font-display text-2xl font-semibold">{me.fullName}</h1>
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0" aria-label={t('nav.account')}>
            {links.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors', isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')
                }
              >
                <Icon className="size-4" /> {label}
              </NavLink>
            ))}
            <button
              onClick={() => logout.mutate(undefined, { onSuccess: () => { toast.success(t('auth.loggedOut')); navigate('/') } })}
              className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-sale"
            >
              <LogOut className="size-4" /> {t('nav.logout')}
            </button>
          </nav>
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </Container>
    </>
  )
}
