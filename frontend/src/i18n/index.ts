import i18n from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'
import { LANGUAGES, type Language } from '@/lib/utils'
import vi from './locales/vi.json'

/**
 * Vietnamese ships in the main bundle; the other languages are separate ~10 KB chunks loaded on demand.
 * Admin strings live in the "admin" namespace (locales/admin), loaded only inside /admin.
 * Resolves once the starting language is ready so the first paint is already translated.
 */
export async function initI18n(language: Language) {
  await i18n
    .use(
      resourcesToBackend((lng: string, ns: string) =>
        // The back office has its own namespace so shoppers never download its strings
        ns === 'admin' ? import(`./locales/admin/${lng}.json`) : import(`./locales/${lng}.json`),
      ),
    )
    .use(initReactI18next)
    .init({
      lng: language,
      fallbackLng: 'vi',
      supportedLngs: LANGUAGES.map((l) => l.code),
      partialBundledLanguages: true,
      resources: { vi: { translation: vi } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    })
  return i18n
}

const cjkFonts: Partial<Record<Language, string>> = {
  ja: 'Noto+Sans+JP:wght@400;500;700',
  ko: 'Noto+Sans+KR:wght@400;500;700',
}

/** Japanese/Korean UI fonts are only downloaded when someone actually picks that language. */
export function ensureFontsFor(language: Language) {
  const family = cjkFonts[language]
  if (!family || document.querySelector(`link[data-font="${language}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
  link.dataset.font = language
  document.head.appendChild(link)
}
