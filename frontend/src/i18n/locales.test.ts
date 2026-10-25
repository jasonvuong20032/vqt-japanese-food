import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import vi from './locales/vi.json'
import adminEn from './locales/admin/en.json'
import adminFr from './locales/admin/fr.json'
import adminJa from './locales/admin/ja.json'
import adminKo from './locales/admin/ko.json'
import adminVi from './locales/admin/vi.json'

// Leaves are strings, or string lists such as search.suggestions
type Leaf = string | string[]
type Tree = { [key: string]: Leaf | Tree }
const isLeaf = (node: Leaf | Tree): node is Leaf => typeof node === 'string' || Array.isArray(node)

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (isLeaf(v) ? [prefix + k] : keys(v, `${prefix}${k}.`)))
}

function lookup(tree: Tree, key: string): Leaf | Tree | undefined {
  return key.split('.').reduce<Leaf | Tree | undefined>((node, part) => (node && !isLeaf(node) ? node[part] : undefined), tree)
}

const isBlank = (leaf: Leaf | Tree | undefined) =>
  typeof leaf === 'string' ? leaf.trim() === '' : Array.isArray(leaf) ? leaf.length === 0 || leaf.some((s) => s.trim() === '') : true

const pluralBase = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '')
const placeholders = (value: unknown) =>
  typeof value === 'string' ? [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort().join(',') : ''

const namespaces: Record<string, Record<string, Tree>> = {
  translation: { vi, en, ja, ko, fr },
  admin: { vi: adminVi, en: adminEn, ja: adminJa, ko: adminKo, fr: adminFr },
}

describe.each(Object.entries(namespaces))('translations (%s namespace)', (_, locales) => {
  const viTree = locales.vi
  const reference = new Set(keys(viTree).map(pluralBase))

  it.each(Object.keys(locales))('%s has exactly the same keys as Vietnamese', (lang) => {
    const own = new Set(keys(locales[lang]).map(pluralBase))
    expect([...reference].filter((k) => !own.has(k))).toEqual([])
    expect([...own].filter((k) => !reference.has(k))).toEqual([])
  })

  it.each(Object.keys(locales))('%s has no empty strings', (lang) => {
    const tree = locales[lang]
    expect(keys(tree).filter((k) => isBlank(lookup(tree, k)))).toEqual([])
  })

  it('uses the same {{placeholders}} as Vietnamese in every language', () => {
    const mismatches: string[] = []
    for (const key of keys(viTree)) {
      const expected = placeholders(lookup(viTree, key))
      for (const [lang, tree] of Object.entries(locales)) {
        // English/French split plurals into key_one + key; the "other" form must carry the same variables
        const value = lookup(tree, key)
        if (value !== undefined && placeholders(value) !== expected) mismatches.push(`${lang}:${key}`)
      }
    }
    expect(mismatches).toEqual([])
  })
})
