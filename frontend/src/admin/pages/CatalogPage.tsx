import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { Dialog, DialogContent } from '@/components/ui/overlay'
import { errorMessage, fieldError } from '@/lib/errors'
import { ApiError } from '@/api/client'
import { useAdminCatalog, useDeleteCatalogNode, useSaveCatalogNode } from '../api'
import type { AdminCatalog, AdminCategory, LocalizedText, NameInput } from '../types'
import { ConfirmDialog, PageHeader, Segmented } from '../ui'

const OTHER_LANGS = ['en', 'ja', 'ko', 'fr'] as const

type Editing =
  | { kind: 'catalogs'; node: AdminCatalog | null }
  | { kind: 'categories'; node: AdminCategory | null; catalogId: number }

export default function CatalogPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const { data, isPending, isError, refetch } = useAdminCatalog()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<{ kind: 'catalogs' | 'categories'; id: number; name: string } | null>(null)
  const remove = useDeleteCatalogNode()

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <>
      <PageHeader
        title={t('catalog.title')}
        description={t('catalog.subtitle')}
        actions={
          <Button onClick={() => setEditing({ kind: 'catalogs', node: null })}>
            <Plus /> {t('catalog.newSection')}
          </Button>
        }
      />

      <div className="space-y-4">
        {isPending
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
          : data?.map((c) => (
              <section key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <header className="flex flex-wrap items-center gap-4 border-b border-border p-4">
                  <span className="block h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {c.coverImageUrl ? <img src={c.coverImageUrl} alt="" className="size-full object-cover" loading="lazy" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                      {c.isActive ? null : <Badge variant="muted">{t('products.hidden')}</Badge>}
                      <TranslationDots translations={c.translations} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">/menu/{c.slug}</span> · {t('catalog.order', { n: c.sortOrder })} ·{' '}
                      {t('catalog.dishCount', { count: c.categories.reduce((n, x) => n + x.productCount, 0) })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing({ kind: 'categories', node: null, catalogId: c.id })}>
                      <Plus /> {t('catalog.newCategory')}
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ kind: 'catalogs', node: c })} aria-label={t('catalog.editNamed', { name: c.name })}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-sale" onClick={() => setDeleting({ kind: 'catalogs', id: c.id, name: c.name })} aria-label={t('catalog.deleteNamed', { name: c.name })}>
                      <Trash2 />
                    </Button>
                  </div>
                </header>
                {c.categories.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted-foreground">{t('catalog.noCategories')}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {c.categories.map((cat) => (
                      <li key={cat.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{cat.name}</span>
                            {cat.isActive ? null : <Badge variant="muted">{t('products.hidden')}</Badge>}
                            <TranslationDots translations={cat.translations} />
                          </span>
                          {cat.description ? <span className="line-clamp-1 text-xs text-muted-foreground">{cat.description}</span> : null}
                        </span>
                        <Link to={`/admin/products?category=${cat.id}`} className="text-sm text-muted-foreground tabular-nums hover:text-primary">
                          {t('catalog.dishCount', { count: cat.productCount })}
                        </Link>
                        <span className="flex gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ kind: 'categories', node: cat, catalogId: c.id })} aria-label={t('catalog.editNamed', { name: cat.name })}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-sale" onClick={() => setDeleting({ kind: 'categories', id: cat.id, name: cat.name })} aria-label={t('catalog.deleteNamed', { name: cat.name })}>
                            <Trash2 />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
      </div>

      {editing ? <NodeDialog editing={editing} catalogs={data ?? []} onClose={() => setEditing(null)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('catalog.deleteTitle', { name: deleting?.name ?? '' })}
        text={t(deleting?.kind === 'catalogs' ? 'catalog.deleteSectionText' : 'catalog.deleteCategoryText')}
        confirmLabel={t('products.delete')}
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { kind: deleting.kind, id: deleting.id },
            {
              onSuccess: () => {
                toast.success(t('catalog.deleted', { name: deleting.name }))
                setDeleting(null)
              },
              onError: (e) => {
                toast.error(e instanceof ApiError && e.code.endsWith('_not_empty') ? t(`catalog.errors.${e.code}`) : errorMessage(tc, e))
                setDeleting(null)
              },
            },
          )
        }
      />
    </>
  )
}

function TranslationDots({ translations }: { translations: Record<string, LocalizedText> }) {
  const { t } = useTranslation('admin')
  const missing = OTHER_LANGS.filter((l) => !translations[l]?.name)
  if (missing.length === 0) return null
  return (
    <Badge variant="warning" title={missing.map((l) => l.toUpperCase()).join(', ')}>
      {t('catalog.missingTranslations', { languages: missing.map((l) => l.toUpperCase()).join(' ') })}
    </Badge>
  )
}

function NodeDialog({ editing, catalogs, onClose }: { editing: Editing; catalogs: AdminCatalog[]; onClose: () => void }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const save = useSaveCatalogNode()
  const node = editing.node
  const isSection = editing.kind === 'catalogs'
  const [lang, setLang] = useState<'vi' | (typeof OTHER_LANGS)[number]>('vi')
  const [form, setForm] = useState<NameInput>(() => ({
    name: node?.name ?? '',
    description: node?.description ?? '',
    isActive: node?.isActive ?? true,
    sortOrder: node?.sortOrder ?? 0,
    slug: isSection ? (node as AdminCatalog | null)?.slug ?? '' : undefined,
    coverImageUrl: isSection ? (node as AdminCatalog | null)?.coverImageUrl ?? '' : undefined,
    catalogId: isSection ? undefined : editing.kind === 'categories' ? editing.catalogId : undefined,
    translations: Object.fromEntries(OTHER_LANGS.map((l) => [l, { name: node?.translations[l]?.name ?? '', description: node?.translations[l]?.description ?? '' }])),
  }))
  const [nameError, setNameError] = useState<string | undefined>()

  const set = <K extends keyof NameInput>(key: K, value: NameInput[K]) => setForm((v) => ({ ...v, [key]: value }))
  const setTr = (l: string, key: keyof LocalizedText, value: string) =>
    setForm((v) => ({ ...v, translations: { ...v.translations, [l]: { ...v.translations[l], [key]: value } } }))

  const submit = () => {
    if (!form.name.trim()) {
      setLang('vi')
      setNameError('required')
      return
    }
    const translations = Object.fromEntries(
      Object.entries(form.translations).filter(([, v]) => v.name.trim()).map(([l, v]) => [l, { name: v.name.trim(), description: v.description?.trim() || null }]),
    )
    save.mutate(
      {
        kind: editing.kind,
        id: node?.id ?? null,
        input: { ...form, name: form.name.trim(), description: form.description?.trim() || null, slug: form.slug?.trim() || null, coverImageUrl: form.coverImageUrl?.trim() || null, translations },
      },
      {
        onSuccess: () => {
          toast.success(t('catalog.saved'))
          onClose()
        },
        onError: (e) => toast.error(errorMessage(tc, e)),
      },
    )
  }

  const title = isSection ? (node ? t('catalog.editSection') : t('catalog.newSection')) : node ? t('catalog.editCategory') : t('catalog.newCategory')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={title} closeLabel={t('common.cancel')} className="max-w-xl">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Segmented
            label={t('productEdit.language')}
            value={lang}
            onChange={setLang}
            options={[{ value: 'vi' as const, label: 'VI' }, ...OTHER_LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))]}
          />
          {lang === 'vi' ? (
            <>
              <Field label={t('catalog.name')} error={fieldError(tc, nameError)}>
                {(id, d) => (
                  <Input id={id} aria-describedby={d} aria-invalid={!!nameError} value={form.name} onChange={(e) => {
                    set('name', e.target.value)
                    setNameError(undefined)
                  }} />
                )}
              </Field>
              <Field label={t('catalog.description')} optional={tc('common.optional')}>
                {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />}
              </Field>
            </>
          ) : (
            <div lang={lang} className="space-y-4">
              <Field label={t('catalog.name')} optional={tc('common.optional')}>
                {(id, d) => <Input id={id} aria-describedby={d} value={form.translations[lang]?.name ?? ''} onChange={(e) => setTr(lang, 'name', e.target.value)} />}
              </Field>
              <Field label={t('catalog.description')} optional={tc('common.optional')}>
                {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} value={form.translations[lang]?.description ?? ''} onChange={(e) => setTr(lang, 'description', e.target.value)} />}
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {isSection ? (
              <Field label={t('productEdit.slug')} hint={t('catalog.slugHint')} optional={tc('common.optional')}>
                {(id, d) => <Input id={id} aria-describedby={d} className="font-mono" value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)} />}
              </Field>
            ) : (
              <Field label={t('catalog.section')}>
                {(id, d) => (
                  <Select id={id} aria-describedby={d} value={form.catalogId ?? ''} onChange={(e) => set('catalogId', Number(e.target.value))}>
                    {catalogs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </Field>
            )}
            <Field label={t('catalog.sortOrder')} hint={t('catalog.sortHint')}>
              {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value) || 0)} />}
            </Field>
          </div>
          {isSection ? (
            <Field label={t('catalog.cover')} hint={t('catalog.coverHint')} optional={tc('common.optional')}>
              {(id, d) => <Input id={id} aria-describedby={d} value={form.coverImageUrl ?? ''} onChange={(e) => set('coverImageUrl', e.target.value)} placeholder="/Uploads/Product/…" />}
            </Field>
          ) : null}
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <Checkbox checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            <span className="text-sm font-medium">{t('catalog.visible')}</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{t('productEdit.save')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
