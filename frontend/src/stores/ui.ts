import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectLanguage, isLanguage, type Language, type Theme } from '@/lib/utils'

interface UiState {
  theme: Theme
  language: Language
  cartOpen: boolean
  searchOpen: boolean
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  setCartOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
}

function initialTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: initialTheme(),
      language: detectLanguage(),
      cartOpen: false,
      searchOpen: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setCartOpen: (cartOpen) => set({ cartOpen }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
    }),
    {
      name: 'jf-ui',
      partialize: (s) => ({ theme: s.theme, language: s.language }),
      // A shared link with ?lang=ja should win over the remembered language
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<UiState>
        const fromQuery = new URLSearchParams(window.location.search).get('lang')?.slice(0, 2)
        return {
          ...current,
          ...saved,
          language: isLanguage(fromQuery) ? fromQuery : (saved.language ?? current.language),
        }
      },
    },
  ),
)

export const useLang = () => useUiStore((s) => s.language)
