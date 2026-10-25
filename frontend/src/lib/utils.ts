import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', short: 'VI', locale: 'vi-VN' },
  { code: 'en', label: 'English', short: 'EN', locale: 'en-US' },
  { code: 'ja', label: '日本語', short: 'JA', locale: 'ja-JP' },
  { code: 'ko', label: '한국어', short: 'KO', locale: 'ko-KR' },
  { code: 'fr', label: 'Français', short: 'FR', locale: 'fr-FR' },
] as const

export type Language = (typeof LANGUAGES)[number]['code']

export const THEMES = ['light', 'dark', 'ocean', 'midnight'] as const
export type Theme = (typeof THEMES)[number]

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && LANGUAGES.some((l) => l.code === value)
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function localeOf(lang: Language) {
  return LANGUAGES.find((l) => l.code === lang)?.locale ?? 'vi-VN'
}

/** Best guess for a first-time visitor: ?lang=, then the browser language, then Vietnamese. */
export function detectLanguage(): Language {
  const fromQuery = new URLSearchParams(window.location.search).get('lang')?.slice(0, 2)
  if (isLanguage(fromQuery)) return fromQuery
  for (const candidate of navigator.languages ?? [navigator.language]) {
    const code = candidate.slice(0, 2).toLowerCase()
    if (isLanguage(code)) return code
  }
  return 'vi'
}

export function hasSessionHint() {
  return document.cookie.split('; ').some((c) => c === 'jf_si=1')
}

/**
 * Only follow same-site redirects ("/checkout"), never "https://evil.example".
 * "//host" and "/\host" are both protocol-relative to a browser, so they are refused too.
 */
export function safeRedirect(value: string | null) {
  return value && /^\/(?![/\\])/.test(value) ? value : '/'
}
