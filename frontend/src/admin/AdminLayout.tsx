import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
  FolderTree,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu as MenuIcon,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldAlert,
  Star,
  Store,
  TicketPercent,
  UserCog,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { Toaster } from 'sonner'
import { useLogout, useMe } from '@/api/hooks'
import { useUiSync } from '@/components/layout/RootLayout'
import { LanguageMenu, ThemeMenu } from '@/components/layout/Menus'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/overlay'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'
import { useOrderCounts } from './api'

interface NavItem {
  to: string
  key: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
  /** Hidden from Staff; the API enforces the same rule */
  adminOnly?: boolean
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'sales',
    items: [
      { to: '/admin', key: 'dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/orders', key: 'orders', icon: ReceiptText },
      { to: '/admin/customers', key: 'customers', icon: Users },
      { to: '/admin/coupons', key: 'coupons', icon: TicketPercent },
    ],
  },
  {
    group: 'menu',
    items: [
      { to: '/admin/products', key: 'products', icon: UtensilsCrossed },
      { to: '/admin/catalog', key: 'catalog', icon: FolderTree },
      { to: '/admin/reviews', key: 'reviews', icon: Star },
    ],
  },
  {
    group: 'store',
    items: [
      { to: '/admin/policies', key: 'policies', icon: ScrollText },
      { to: '/admin/settings', key: 'settings', icon: Settings, adminOnly: true },
      { to: '/admin/staff', key: 'staff', icon: UserCog, adminOnly: true },
    ],
  },
]

/** Staff and admins only. Everything under /admin renders inside this shell. */
export default function AdminLayout() {
  const { t, ready } = useTranslation('admin')
  const { data: me, isPending } = useMe()
  const theme = useUiStore((s) => s.theme)
  const location = useLocation()
  useUiSync()

  if (isPending || !ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    )
  }
  if (!me) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (me.role === 'Customer') return <NoAccess />

  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[16rem_1fr] print:block print:bg-white">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card lg:flex print:hidden">
        <Sidebar />
      </aside>
      <div className="min-w-0">
        <TopBar />
        <main id="main" className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-center" theme={theme === 'light' ? 'light' : 'dark'} richColors closeButton duration={3500} />
      <ScrollRestoration />
      <title>{t('meta.title')}</title>
    </div>
  )
}

function Brand() {
  const { t } = useTranslation('admin')
  return (
    <Link to="/admin" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
        <span className="font-jp text-base font-bold">和</span>
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-bold">VQT</span>
        <span className="block text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{t('brand.backOffice')}</span>
      </span>
    </Link>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('admin')
  const { data: counts } = useOrderCounts()
  const pending = counts?.['0'] ?? 0
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label={t('nav.label')}>
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-1 px-3 text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">{t(`nav.groups.${group}`)}</p>
            <div className="space-y-0.5">
              {items
                .filter((item) => !item.adminOnly || me?.role === 'Admin')
                .map(({ to, key, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                        isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="flex-1">{t(`nav.${key}`)}</span>
                    {key === 'orders' && pending > 0 ? (
                      <span className="grid min-w-6 place-items-center rounded-full bg-sale px-1.5 text-xs font-bold text-white" aria-label={t('nav.pendingCount', { count: pending })}>
                        {pending}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-border p-3">
        <Link to="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <Store className="size-5" /> {t('nav.storefront')}
        </Link>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold uppercase">
            {me?.fullName?.[0] ?? '?'}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{me?.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">{me ? t(`roles.${me.role}`) : ''}</span>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </div>
  )
}

function TopBar() {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label={t('nav.open')}>
          <MenuIcon />
        </Button>
        <SheetContent side="left" title={t('nav.label')} hideTitle closeLabel={t('nav.close')} className="max-w-xs p-0">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:hidden">
        <Brand />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <LanguageMenu />
        <ThemeMenu />
      </div>
    </header>
  )
}

export function NoAccess({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation('admin')
  return (
    <div className={cn('grid place-items-center bg-background px-4 text-center text-foreground', inline ? 'py-24' : 'min-h-dvh')}>
      <div className="max-w-sm space-y-4">
        <ShieldAlert className="mx-auto size-12 text-muted-foreground" />
        <h1 className="font-display text-2xl font-semibold">{t('noAccess.title')}</h1>
        <p className="text-muted-foreground">{t('noAccess.text')}</p>
        {inline ? null : (
          <Button asChild>
            <Link to="/">{t('nav.storefront')}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

/** Wraps admin-only pages so Staff who type the address see an explanation instead of failing API calls. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me } = useMe()
  return me?.role === 'Admin' ? <>{children}</> : <NoAccess inline />
}
