import { Check, Globe, LogOut, Package, Palette, User, Heart, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useLogout, useMe } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '@/components/ui/overlay'
import { cn, isLanguage, isTheme, LANGUAGES, THEMES, type Theme } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'

export const THEME_SWATCH: Record<Theme, [string, string]> = {
  light: ['#faf7f2', '#b83a1c'],
  dark: ['#121212', '#f0603f'],
  ocean: ['#08182b', '#2dd4e8'],
  midnight: ['#000000', '#d6ae5c'],
}

export function ThemeSwatch({ theme, className }: { theme: Theme; className?: string }) {
  const [bg, accent] = THEME_SWATCH[theme]
  return (
    <span
      aria-hidden
      className={cn('inline-block size-5 shrink-0 rounded-full border border-black/10 shadow-inner', className)}
      style={{ background: `linear-gradient(135deg, ${bg} 0 55%, ${accent} 55% 100%)` }}
    />
  )
}

export function LanguageMenu() {
  const { t } = useTranslation()
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const current = LANGUAGES.find((l) => l.code === language)
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2.5" aria-label={t('language.label')}>
          <Globe />
          <span className="text-xs font-semibold">{current?.short}</span>
        </Button>
      </MenuTrigger>
      <MenuContent className="w-52">
        <MenuLabel>{t('language.label')}</MenuLabel>
        <MenuRadioGroup value={language} onValueChange={(v) => isLanguage(v) && setLanguage(v)}>
          {LANGUAGES.map((l) => (
            <MenuRadioItem key={l.code} value={l.code}>
              <span className="w-7 text-xs font-semibold text-muted-foreground">{l.short}</span>
              <span lang={l.code}>{l.label}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

export function ThemeMenu() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('theme.label')}>
          <Palette />
        </Button>
      </MenuTrigger>
      <MenuContent className="w-56">
        <MenuLabel>{t('theme.label')}</MenuLabel>
        <MenuRadioGroup value={theme} onValueChange={(v) => isTheme(v) && setTheme(v)}>
          {THEMES.map((th) => (
            <MenuRadioItem key={th} value={th}>
              <ThemeSwatch theme={th} />
              <span className="flex flex-col">
                <span>{t(`theme.${th}`)}</span>
                <span className="text-xs font-normal text-muted-foreground">{t(`theme.${th}Hint`)}</span>
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

/** Theme picker as large tiles, used on mobile and in account settings. */
export function ThemeTiles() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('theme.label')}>
      {THEMES.map((th) => (
        <button
          key={th}
          role="radio"
          aria-checked={theme === th}
          onClick={() => setTheme(th)}
          className={cn(
            'flex items-center gap-2.5 rounded-2xl border p-3 text-left text-sm transition',
            theme === th ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50',
          )}
        >
          <ThemeSwatch theme={th} className="size-7" />
          <span className="font-medium">{t(`theme.${th}`)}</span>
          {theme === th ? <Check className="ml-auto size-4 text-primary" /> : null}
        </button>
      ))}
    </div>
  )
}

export function AccountMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const logout = useLogout()

  if (!me) {
    return (
      <Button variant="ghost" size="icon" asChild>
        <Link to="/login" aria-label={t('nav.login')}>
          <User />
        </Link>
      </Button>
    )
  }

  const initials = me.fullName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-primary/40" aria-label={t('nav.account')}>
          {initials || <User className="size-4" />}
        </button>
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold">{me.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => navigate('/account')}>
          <Settings /> {t('nav.account')}
        </MenuItem>
        <MenuItem onSelect={() => navigate('/account/orders')}>
          <Package /> {t('nav.orders')}
        </MenuItem>
        <MenuItem onSelect={() => navigate('/account/wishlist')}>
          <Heart /> {t('nav.wishlist')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onSelect={() =>
            logout.mutate(undefined, {
              onSuccess: () => {
                toast.success(t('auth.loggedOut'))
                navigate('/')
              },
            })
          }
        >
          <LogOut /> {t('nav.logout')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
