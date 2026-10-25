import { describe, expect, it } from 'vitest'
import { isLanguage, isTheme, localeOf, safeRedirect } from './utils'

describe('safeRedirect', () => {
  it.each(['/checkout', '/account/orders?page=2', '/p/sashimi-otoro#reviews'])('keeps same-site path %s', (path) => {
    expect(safeRedirect(path)).toBe(path)
  })

  it.each([null, '', 'checkout', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])(
    'falls back to / for %s',
    (value) => {
      expect(safeRedirect(value)).toBe('/')
    },
  )
})

describe('language and theme guards', () => {
  it('accepts only the supported codes', () => {
    expect(['vi', 'en', 'ja', 'ko', 'fr'].every(isLanguage)).toBe(true)
    expect(isLanguage('de')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
    expect(isTheme('midnight')).toBe(true)
    expect(isTheme('neon')).toBe(false)
  })

  it('maps languages to locales', () => {
    expect(localeOf('ja')).toBe('ja-JP')
    expect(localeOf('fr')).toBe('fr-FR')
  })
})
