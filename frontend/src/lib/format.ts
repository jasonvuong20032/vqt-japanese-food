import { useMemo } from 'react'
import { useLang } from '@/stores/ui'
import { localeOf, type Language } from '@/lib/utils'

export function makeFormat(lang: Language) {
  const locale = localeOf(lang)
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
  const number = new Intl.NumberFormat(locale)
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })

  return {
    /** BCP 47 locale behind these formatters, for one-off Intl formats */
    locale,
    money: (value: number) => money.format(value),
    number: (value: number) => number.format(value),
    compact: (value: number) => compact.format(value),
    date: (value: string) => date.format(new Date(value)),
    dateTime: (value: string) => dateTime.format(new Date(value)),
  }
}

export type Formatter = ReturnType<typeof makeFormat>

/** Locale-aware money/date formatting that follows the selected language (VND everywhere). */
export function useFormat(): Formatter {
  const lang = useLang()
  return useMemo(() => makeFormat(lang), [lang])
}
