import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowRight, CornerDownLeft, History, LoaderCircle, Search, TrendingUp, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCatalog, useSearchSuggestions } from '@/api/hooks'
import { Kanji } from '@/components/ui/misc'
import { useFormat } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'

const RECENT_KEY = 'jf-recent-searches'

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function rememberSearch(query: string) {
  const q = query.trim()
  if (!q) return
  const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

/** Accent-insensitive fold, mirroring the server's SearchNormalizer. */
function fold(s: string) {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

/** Bolds the parts of `text` that match the query, even when the user typed without accents. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const terms = fold(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return <>{text}</>
  // Folding can change length only for combining marks, so map folded indexes back char by char
  const chars = [...text]
  const folded = chars.map((c) => fold(c))
  const mark = new Array(chars.length).fill(false)
  const flat = folded.join('')
  const starts: number[] = []
  let pos = 0
  for (const piece of folded) {
    starts.push(pos)
    pos += piece.length
  }
  for (const term of terms) {
    let from = flat.indexOf(term)
    while (from !== -1) {
      const to = from + term.length
      chars.forEach((_, i) => {
        if (starts[i] >= from && starts[i] < to) mark[i] = true
      })
      from = flat.indexOf(term, to)
    }
  }
  const out: ReactNode[] = []
  let buffer = ''
  let marked = false
  chars.forEach((c, i) => {
    if (mark[i] !== marked && buffer) {
      out.push(marked ? <mark key={i} className="bg-transparent font-semibold text-primary">{buffer}</mark> : buffer)
      buffer = ''
    }
    marked = mark[i]
    buffer += c
  })
  if (buffer) out.push(marked ? <mark key="end" className="bg-transparent font-semibold text-primary">{buffer}</mark> : buffer)
  return <>{out}</>
}

type Item = { key: string; run: () => void; render: (active: boolean) => ReactNode }

export function SearchPalette() {
  const { t } = useTranslation()
  const f = useFormat()
  const navigate = useNavigate()
  const open = useUiStore((s) => s.searchOpen)
  const setOpen = useUiStore((s) => s.setSearchOpen)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const { data: catalog } = useCatalog()
  const { data, isFetching } = useSearchSuggestions(debounced)

  // Ctrl/Cmd + K or "/" opens the palette from anywhere
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')
      if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setRecent(readRecent())
      setActive(0)
    } else {
      setQuery('')
      setDebounced('')
    }
  }, [open])

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 180)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => setActive(0), [debounced])

  const go = (to: string, remember?: string) => {
    if (remember) rememberSearch(remember)
    setOpen(false)
    navigate(to)
  }

  const suggestions = t('search.suggestions', { returnObjects: true }) as string[]
  const showResults = debounced.trim().length > 0 && !!data

  const items: Item[] = useMemo(() => {
    const list: Item[] = []
    if (showResults && data) {
      for (const c of data.categories) {
        const to = c.categoryId ? `/menu/${c.catalogSlug}?category=${c.categoryId}` : `/menu/${c.catalogSlug}`
        list.push({
          key: `c-${c.catalogId}-${c.categoryId ?? 0}`,
          run: () => go(to, debounced),
          render: () => (
            <>
              <Thumb src={c.imageUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  <Highlight text={c.name} query={debounced} />
                </span>
                <span className="text-xs text-muted-foreground">{t('search.categoryCount', { count: c.productCount })}</span>
              </span>
              <Kanji className="text-xs">{c.japaneseName}</Kanji>
            </>
          ),
        })
      }
      for (const p of data.products) {
        list.push({
          key: `p-${p.id}`,
          run: () => go(`/p/${p.slug}`, debounced),
          render: () => (
            <>
              <Thumb src={p.imageUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  <Highlight text={p.name} query={debounced} />
                </span>
                <span className="block truncate text-xs text-muted-foreground">{p.categoryName}</span>
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">
                {f.money(p.effectivePrice)}
                {p.discountPercent > 0 ? <span className="block text-xs font-normal text-muted-foreground line-through">{f.money(p.price)}</span> : null}
              </span>
            </>
          ),
        })
      }
      if (data.totalProducts > 0) {
        list.push({
          key: 'all',
          run: () => go(`/menu?q=${encodeURIComponent(debounced)}`, debounced),
          render: () => (
            <span className="flex w-full items-center justify-center gap-2 py-1 font-medium text-primary">
              {t('search.viewAll', { count: data.totalProducts })} <ArrowRight className="size-4" />
            </span>
          ),
        })
      }
    } else if (!debounced.trim()) {
      for (const r of recent) {
        list.push({
          key: `r-${r}`,
          run: () => setQuery(r),
          render: () => (
            <>
              <History className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">{r}</span>
            </>
          ),
        })
      }
    }
    return list
  }, [data, showResults, debounced, recent, f, t])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (items.length ? (i + 1) % items.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[active] && (debounced === query || !query.trim())) items[active].run()
      else if (query.trim()) go(`/menu?q=${encodeURIComponent(query.trim())}`, query)
    }
  }

  const categoryCount = data?.categories.length ?? 0

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms]" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[100dvh] w-full flex-col overflow-hidden border-border bg-card text-card-foreground shadow-2xl outline-none data-[state=open]:animate-[pop-in_200ms_cubic-bezier(0.16,1,0.3,1)] sm:top-[10vh] sm:max-h-[75vh] sm:max-w-2xl sm:rounded-3xl sm:border"
        >
          <DialogPrimitive.Title className="sr-only">{t('nav.search')}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t('search.placeholder')}</DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b border-border px-5">
            {isFetching ? <LoaderCircle className="size-5 shrink-0 animate-spin text-muted-foreground" /> : <Search className="size-5 shrink-0 text-muted-foreground" />}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              role="combobox"
              aria-expanded
              aria-controls="search-results"
              aria-activedescendant={items[active] ? `search-item-${active}` : undefined}
              className="h-16 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button onClick={() => setQuery('')} className="grid size-8 place-items-center rounded-full hover:bg-muted" aria-label={t('common.clear')}>
                <X className="size-4" />
              </button>
            ) : null}
            <DialogPrimitive.Close className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">Esc</DialogPrimitive.Close>
          </div>

          <div ref={listRef} id="search-results" role="listbox" className="flex-1 overflow-y-auto p-2">
            {showResults && items.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="font-medium">{t('search.noResults', { query: debounced })}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('search.noResultsHint')}</p>
              </div>
            ) : null}

            {!debounced.trim() ? (
              <div className="space-y-5 px-3 py-3">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <TrendingUp className="size-3.5" /> {t('search.popular')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => setQuery(s)} className="rounded-full border border-border px-3.5 py-1.5 text-sm transition hover:border-primary hover:text-primary">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {catalog?.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('search.browse')}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {catalog.map((c) => (
                        <button key={c.id} onClick={() => go(`/menu/${c.slug}`)} className="group flex items-center gap-3 rounded-2xl border border-border p-2 text-left transition hover:border-primary">
                          <Thumb src={c.imageUrl} className="size-11" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium group-hover:text-primary">{c.name}</span>
                            <Kanji className="text-[11px] tracking-[0.2em]">{c.japaneseName}</Kanji>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {recent.length ? (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('search.recent')}</p>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        localStorage.removeItem(RECENT_KEY)
                        setRecent([])
                      }}
                    >
                      {t('search.clearRecent')}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {items.map((item, index) => {
              const heading =
                showResults && index === 0 && categoryCount > 0
                  ? t('search.categories')
                  : showResults && index === categoryCount && (data?.products.length ?? 0) > 0
                    ? t('search.products')
                    : null
              return (
                <div key={item.key}>
                  {heading ? <p className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{heading}</p> : null}
                  <button
                    id={`search-item-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={item.run}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                      index === active ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    {item.render(index === active)}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="hidden items-center gap-4 border-t border-border px-5 py-2.5 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border px-1">↑</kbd>
              <kbd className="rounded border border-border px-1">↓</kbd> {t('search.navigate')}
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="size-3.5" /> {t('search.select')}
            </span>
            <span className="ml-auto">{t('search.poweredHint')}</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn('block size-12 shrink-0 overflow-hidden rounded-xl bg-muted', className)}>
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : null}
    </span>
  )
}
