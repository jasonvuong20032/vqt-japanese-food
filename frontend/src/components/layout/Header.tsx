import { ChevronDown, Menu as MenuIcon, Search, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router'
import { useCatalog, useMe, useStore } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Kanji } from '@/components/ui/misc'
import { Menu, MenuContent, MenuItem, MenuTrigger, Sheet, SheetClose, SheetContent } from '@/components/ui/overlay'
import { useFormat } from '@/lib/format'
import { cn, LANGUAGES } from '@/lib/utils'
import { useCartCount } from '@/stores/cart'
import { useUiStore } from '@/stores/ui'
import { AccountMenu, LanguageMenu, ThemeMenu, ThemeTiles } from './Menus'

export function Logo({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Link to="/" className={cn('group flex shrink-0 items-center gap-2.5', className)} aria-label={t('brand.name')}>
      <span className="relative grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:rotate-12">
        <span className="font-jp text-base leading-none font-bold">和</span>
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-bold tracking-tight">VQT</span>
        <span className="block text-[10px] font-semibold tracking-[0.25em] whitespace-nowrap text-muted-foreground uppercase">Japanese Food</span>
      </span>
    </Link>
  )
}

function AnnouncementBar() {
  const { t } = useTranslation()
  const f = useFormat()
  const { data } = useStore()
  if (!data) return <div className="h-9 bg-secondary" />
  return (
    <div className="bg-secondary text-secondary-foreground">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-6 overflow-hidden px-4 text-xs font-medium">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Truck className="size-3.5" />
          {t('announcement.freeShipping', { amount: f.money(data.info.freeShippingThreshold) })}
        </span>
        <span className="hidden items-center gap-1.5 whitespace-nowrap sm:flex">
          <Sparkles className="size-3.5" /> {t('announcement.delivery')}
        </span>
        <span className="hidden whitespace-nowrap md:inline">{t('announcement.hours', { hours: data.info.openingHours })}</span>
      </div>
    </div>
  )
}

function MenuMega() {
  const { t } = useTranslation()
  const { data: catalog } = useCatalog()
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted data-[state=open]:bg-muted">
          {t('nav.menu')} <ChevronDown className="size-4 transition-transform data-[state=open]:rotate-180" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" sideOffset={14} className="w-[min(92vw,60rem)] p-4">
        <div className="grid grid-cols-3 gap-2">
          {catalog?.map((c) => (
            <MenuItem key={c.id} asChild className="items-start gap-3 rounded-2xl p-2.5">
              <Link to={`/menu/${c.slug}`}>
                <span className="block size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {c.imageUrl ? <img src={c.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
                </span>
                <span className="min-w-0">
                  <Kanji className="block text-[11px] tracking-[0.2em]">{c.japaneseName}</Kanji>
                  <span className="block font-display text-base font-semibold text-foreground">{c.name}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{c.categories.map((x) => x.name).join(' · ')}</span>
                </span>
              </Link>
            </MenuItem>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t('nav.menuPromo')}</span>
          <Link to="/menu" className="font-semibold text-primary hover:underline">
            {t('nav.fullMenu')} →
          </Link>
        </div>
      </MenuContent>
    </Menu>
  )
}

function MobileMenu() {
  const { t } = useTranslation()
  const { data: catalog } = useCatalog()
  const { data: me } = useMe()
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname, location.search])

  const link = 'block rounded-xl px-3 py-2.5 text-base font-medium hover:bg-muted'
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label={t('nav.openMenu')}>
        <MenuIcon />
      </Button>
      <SheetContent side="left" title={<Logo />} closeLabel={t('nav.closeMenu')} className="max-w-sm">
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <div className="space-y-1">
            <SheetClose asChild><Link to="/" className={link}>{t('nav.home')}</Link></SheetClose>
            <SheetClose asChild><Link to="/menu?sort=best_selling" className={link}>{t('nav.bestSellers')}</Link></SheetClose>
            <SheetClose asChild><Link to="/menu?onSale=true" className={link}>{t('nav.deals')}</Link></SheetClose>
            <SheetClose asChild><Link to="/about" className={link}>{t('nav.about')}</Link></SheetClose>
            <SheetClose asChild><Link to="/track" className={link}>{t('nav.track')}</Link></SheetClose>
            {me ? (
              <SheetClose asChild><Link to="/account" className={link}>{t('nav.account')}</Link></SheetClose>
            ) : (
              <SheetClose asChild><Link to="/login" className={link}>{t('nav.login')}</Link></SheetClose>
            )}
          </div>
          <div>
            <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('nav.menu')}</p>
            <div className="grid grid-cols-2 gap-2">
              {catalog?.map((c) => (
                <SheetClose key={c.id} asChild>
                  <Link to={`/menu/${c.slug}`} className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                    {c.imageUrl ? <img src={c.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                      <span className="block font-display text-sm font-semibold">{c.name}</span>
                    </span>
                  </Link>
                </SheetClose>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('language.label')}</p>
            <div className="flex flex-wrap gap-2 px-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', language === l.code ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
                  lang={l.code}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('theme.label')}</p>
            <ThemeTiles />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function Header() {
  const { t } = useTranslation()
  const count = useCartCount()
  const setCartOpen = useUiStore((s) => s.setCartOpen)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const [scrolled, setScrolled] = useState(false)
  const [bump, setBump] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Little bounce on the cart icon whenever something is added
  useEffect(() => {
    if (count === 0) return
    setBump(true)
    const id = setTimeout(() => setBump(false), 450)
    return () => clearTimeout(id)
  }, [count])

  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const onMenuRoot = location.pathname === '/menu'
  const nav = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted', isActive && 'text-primary')

  return (
    <>
      <AnnouncementBar />
      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-[background,box-shadow,border-color] duration-300',
          scrolled ? 'border-border bg-background/85 shadow-sm backdrop-blur-xl' : 'border-transparent bg-background',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 md:h-[72px]">
          <MobileMenu />
          <Logo className="mr-2" />
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label={t('nav.main')}>
            <MenuMega />
            {/* NavLink ignores the query string, so these two compute "active" themselves */}
            <Link to="/menu?sort=best_selling" className={nav({ isActive: onMenuRoot && query.get('sort') === 'best_selling' })}>{t('nav.bestSellers')}</Link>
            <Link to="/menu?onSale=true" className={nav({ isActive: onMenuRoot && query.get('onSale') === 'true' })}>{t('nav.deals')}</Link>
            {/* Long labels (French, Korean) would crowd small laptops: these two appear from xl up */}
            <NavLink to="/about" className={(a) => cn(nav(a), 'hidden xl:inline-flex')}>{t('nav.about')}</NavLink>
            <NavLink to="/track" className={(a) => cn(nav(a), 'hidden xl:inline-flex')}>{t('nav.track')}</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 w-56 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground transition hover:border-primary/50 md:flex lg:w-44 xl:w-72"
            >
              <Search className="size-4" />
              <span className="flex-1 truncate text-left">{t('search.short')}</span>
              <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label={t('nav.search')}>
              <Search />
            </Button>
            <div className="hidden sm:flex">
              <LanguageMenu />
              <ThemeMenu />
            </div>
            <AccountMenu />
            <Button variant="ghost" size="icon" className="relative" onClick={() => setCartOpen(true)} aria-label={t('cart.openWithCount', { count })}>
              <ShoppingBag className={cn('transition-transform', bump && 'scale-125')} />
              {count > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </header>
    </>
  )
}
