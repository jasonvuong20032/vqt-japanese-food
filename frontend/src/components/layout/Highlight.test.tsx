import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Highlight } from './SearchPalette'

const marked = (text: string, query: string) =>
  [...renderToStaticMarkup(<Highlight text={text} query={query} />).matchAll(/<mark[^>]*>(.*?)<\/mark>/g)].map((m) => m[1])

describe('Highlight', () => {
  it('matches without accents and keeps the original spelling', () => {
    expect(marked('Cá hồi nướng', 'ca hoi')).toEqual(['Cá', 'hồi'])
  })

  it('folds đ to d', () => {
    expect(marked('Đậu phụ chiên', 'dau')).toEqual(['Đậu'])
  })

  it('works for Japanese text', () => {
    expect(marked('大トロ刺身', 'トロ')).toEqual(['トロ'])
  })

  it('leaves text alone when nothing matches', () => {
    expect(renderToStaticMarkup(<Highlight text="Mochi" query="ramen" />)).toBe('Mochi')
  })
})
