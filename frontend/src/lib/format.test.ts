import { describe, expect, it } from 'vitest'
import { makeFormat } from './format'

// Intl output uses narrow/regular no-break spaces depending on the locale; compare on plain spaces
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('money formatting', () => {
  it('is always VND without decimals', () => {
    expect(plain(makeFormat('vi').money(145_000))).toBe('145.000 ₫')
    expect(plain(makeFormat('en').money(145_000))).toBe('₫145,000')
    expect(makeFormat('ja').money(145_000)).toContain('145,000')
    expect(plain(makeFormat('fr').money(145_000))).toBe('145 000 ₫')
  })

  it('rounds stray decimals away', () => {
    expect(plain(makeFormat('vi').money(99_999.6))).toBe('100.000 ₫')
  })

  it('formats plain numbers per locale', () => {
    expect(makeFormat('vi').number(1234567)).toBe('1.234.567')
    expect(makeFormat('en').number(1234567)).toBe('1,234,567')
  })
})
