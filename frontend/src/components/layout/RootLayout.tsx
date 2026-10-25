import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, ScrollRestoration, useNavigation } from 'react-router'
import { Toaster } from 'sonner'
import { saveServerPreferences, useMe } from '@/api/hooks'
import { queryClient } from '@/api/client'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ensureFontsFor } from '@/i18n'
import { useUiStore } from '@/stores/ui'
import { Footer } from './Footer'
import { Header } from './Header'
import { SearchPalette } from './SearchPalette'

const THEME_COLOR = { light: '#faf7f2', dark: '#121212', ocean: '#08182b', midnight: '#000000' } as const

/** Keeps <html data-theme/lang>, i18next and the signed-in user's saved preferences in sync with the UI store. */
export function useUiSync() {
  const { i18n } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const language = useUiStore((s) => s.language)
  const { data: me } = useMe()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
    ensureFontsFor(language)
    if (i18n.language !== language) void i18n.changeLanguage(language)
  }, [language, i18n])

  useEffect(() => {
    if (!me) return
    if (me.preferredLanguage !== language || me.preferredTheme !== theme) {
      saveServerPreferences(language, theme)
      queryClient.setQueryData(['me'], { ...me, preferredLanguage: language, preferredTheme: theme })
    }
  }, [me, language, theme])
}

function NavigationProgress() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') return null
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/20" role="progressbar" aria-label="Loading">
      <div className="h-full w-1/3 animate-[progress_1s_ease-in-out_infinite] bg-primary" />
    </div>
  )
}

export function RootLayout() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  useUiSync()

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-[70] rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        {t('nav.skipToContent')}
      </a>
      <NavigationProgress />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <SearchPalette />
      <Toaster position="top-center" theme={theme === 'light' ? 'light' : 'dark'} richColors closeButton duration={3500} />
      <ScrollRestoration />
    </div>
  )
}
