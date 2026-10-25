import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMe } from '@/api/hooks'
import { ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { Dialog, DialogContent } from '@/components/ui/overlay'
import { errorMessage, fieldError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { AI_LANGS, AiTranslateButton } from '../AiTranslate'
import { useAdminPolicies, useDeletePolicy, useSavePolicy } from '../api-store'
import type { AdminPolicy, PolicyInput } from '../types'
import { ConfirmDialog, PageHeader, Segmented, serverFieldErrors } from '../ui'

export default function PoliciesPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const { data: me } = useMe()
  const canEdit = me?.role === 'Admin'
  const { data, isPending, isError, refetch } = useAdminPolicies()
  const [editing, setEditing] = useState<AdminPolicy | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminPolicy | null>(null)
  const remove = useDeletePolicy()

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <>
      <PageHeader
        title={t('policies.title')}
        description={t('policies.subtitle')}
        actions={canEdit ? <Button onClick={() => setEditing('new')}><Plus /> {t('policies.new')}</Button> : null}
      />
      {canEdit ? null : <p className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t('policies.readOnly')}</p>}

      <div className="space-y-3">
        {isPending
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : data?.map((p) => {
              const missing = AI_LANGS.filter((l) => !p.translations[l])
              return (
                <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{p.title}</h2>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{p.topic}</span>
                        {p.isActive ? null : <Badge variant="muted">{t('products.hidden')}</Badge>}
                        {missing.length > 0 ? <Badge variant="warning">{t('catalog.missingTranslations', { languages: missing.map((l) => l.toUpperCase()).join(' ') })}</Badge> : null}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">{p.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{t('policies.updated', { date: f.dateTime(p.updatedAt) })}</p>
                    </div>
                    {canEdit ? (
                      <span className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(p)} aria-label={t('catalog.editNamed', { name: p.title })}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" className="text-sale" onClick={() => setDeleting(p)} aria-label={t('catalog.deleteNamed', { name: p.title })}><Trash2 /></Button>
                      </span>
                    ) : null}
                  </div>
                </article>
              )
            })}
      </div>

      {editing ? <PolicyDialog policy={editing === 'new' ? null : editing} nextOrder={(data?.length ?? 0) + 1} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('catalog.deleteTitle', { name: deleting?.title ?? '' })}
        text={t('policies.deleteText')}
        confirmLabel={t('products.delete')}
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('catalog.deleted', { name: deleting.title }))
              setDeleting(null)
            },
            onError: (e) => toast.error(errorMessage(tc, e)),
          })
        }
      />
    </>
  )
}

function PolicyDialog({ policy, nextOrder, onClose }: { policy: AdminPolicy | null; nextOrder: number; onClose: () => void }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const save = useSavePolicy()
  const [lang, setLang] = useState<'vi' | (typeof AI_LANGS)[number]>('vi')
  const [form, setForm] = useState<PolicyInput>(() => ({
    topic: policy?.topic ?? '',
    title: policy?.title ?? '',
    content: policy?.content ?? '',
    sortOrder: policy?.sortOrder ?? nextOrder,
    isActive: policy?.isActive ?? true,
    translations: Object.fromEntries(AI_LANGS.map((l) => [l, { title: policy?.translations[l]?.title ?? '', content: policy?.translations[l]?.content ?? '' }])),
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const err = (key: string) => (errors[key] ? fieldError(tc, errors[key]) : undefined)

  const set = <K extends keyof PolicyInput>(key: K, value: PolicyInput[K]) => {
    setForm((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }
  const setTr = (l: string, key: 'title' | 'content', value: string) =>
    setForm((v) => ({ ...v, translations: { ...v.translations, [l]: { ...v.translations[l], [key]: value } } }))

  const submit = () =>
    save.mutate(
      { id: policy?.id ?? null, input: form },
      {
        onSuccess: () => {
          toast.success(t('catalog.saved'))
          onClose()
        },
        onError: (e) => {
          const fields = serverFieldErrors(e)
          if (Object.keys(fields).length > 0) {
            setErrors(fields)
            setLang('vi')
          } else toast.error(errorMessage(tc, e))
        },
      },
    )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={policy ? t('policies.edit') : t('policies.new')} closeLabel={t('common.cancel')} className="max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              label={t('productEdit.language')}
              value={lang}
              onChange={setLang}
              options={[{ value: 'vi' as const, label: 'VI' }, ...AI_LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))]}
            />
            <AiTranslateButton
              kind="policy"
              source={() => ({ title: form.title, content: form.content })}
              translated={(l) => Boolean(form.translations[l]?.title.trim())}
              onResult={(translations) => {
                for (const [l, values] of Object.entries(translations)) {
                  if (values.title) setTr(l, 'title', values.title)
                  if (values.content) setTr(l, 'content', values.content)
                }
                const first = Object.keys(translations)[0] as (typeof AI_LANGS)[number] | undefined
                if (first) setLang(first)
              }}
            />
          </div>
          {lang === 'vi' ? (
            <>
              <Field label={t('policies.titleField')} error={err('title')}>
                {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} value={form.title} onChange={(e) => set('title', e.target.value)} />}
              </Field>
              <Field label={t('policies.content')} hint={t('policies.contentHint')} error={err('content')}>
                {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.content} rows={8} value={form.content} onChange={(e) => set('content', e.target.value)} />}
              </Field>
            </>
          ) : (
            <div lang={lang} className="space-y-4">
              <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">{t('policies.translationHint')}</p>
              <Field label={t('policies.titleField')} optional={tc('common.optional')}>
                {(id, d) => <Input id={id} aria-describedby={d} value={form.translations[lang]?.title ?? ''} onChange={(e) => setTr(lang, 'title', e.target.value)} />}
              </Field>
              <Field label={t('policies.content')} optional={tc('common.optional')}>
                {(id, d) => <Textarea id={id} aria-describedby={d} rows={8} value={form.translations[lang]?.content ?? ''} onChange={(e) => setTr(lang, 'content', e.target.value)} />}
              </Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('policies.topic')} hint={t('policies.topicHint')} error={err('topic')}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.topic} className="font-mono" value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="delivery" />}
            </Field>
            <Field label={t('catalog.sortOrder')} hint={t('catalog.sortHint')}>
              {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value) || 0)} />}
            </Field>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <Checkbox checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            <span className="text-sm font-medium">{t('policies.isActive')}</span>
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
