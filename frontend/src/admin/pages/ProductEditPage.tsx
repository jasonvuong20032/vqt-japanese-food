import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { applyFieldErrors, errorMessage, fieldError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { cn, LANGUAGES } from '@/lib/utils'
import { useAdminCatalog, useAdminProduct, useProductImages, useSaveProduct } from '../api'
import type { AdminProductEdit, AdminProductInput } from '../types'
import { AiTranslateButton } from '../AiTranslate'
import { ConfirmDialog, PageHeader, Panel, Segmented } from '../ui'

const OTHER_LANGS = ['en', 'ja', 'ko', 'fr'] as const
type OtherLang = (typeof OTHER_LANGS)[number]

const optionalText = (max: number) => z.string().trim().max(max, 'too_long')
const translation = z.object({ name: optionalText(300), shortDescription: optionalText(500), description: optionalText(8000) })

const schema = z
  .object({
    name: z.string().trim().min(1, 'required').max(300, 'too_long'),
    code: optionalText(50),
    slug: optionalText(200),
    categoryId: z.coerce.number<string>().int().positive('required'),
    shortDescription: optionalText(500),
    description: optionalText(8000),
    price: z.coerce.number<string>().positive('must_be_positive'),
    salePrice: z.string().trim(),
    isOnSale: z.boolean(),
    quantity: z.coerce.number<string>().int('must_not_be_negative').min(0, 'must_not_be_negative'),
    isAvailable: z.boolean(),
    isActive: z.boolean(),
    tags: z.string(),
    metaTitle: optionalText(200),
    metaDescription: optionalText(500),
    translations: z.object({ en: translation, ja: translation, ko: translation, fr: translation }),
  })
  .superRefine((v, ctx) => {
    if (!v.isOnSale) return
    const sale = Number(v.salePrice)
    if (!v.salePrice || !(sale > 0) || sale >= v.price) ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'must_be_below_price' })
  })

type FormInput = z.input<typeof schema>
type Values = z.output<typeof schema>


function toForm(data: AdminProductInput | undefined): FormInput {
  const tr = (lang: OtherLang) => {
    const found = data?.translations.find((t) => t.languageCode === lang)
    return { name: found?.name ?? '', shortDescription: found?.shortDescription ?? '', description: found?.description ?? '' }
  }
  return {
    name: data?.name ?? '',
    code: data?.code ?? '',
    slug: data?.slug ?? '',
    categoryId: data ? String(data.categoryId) : '',
    shortDescription: data?.shortDescription ?? '',
    description: data?.description ?? '',
    price: data ? String(data.price) : '',
    salePrice: data?.salePrice ? String(data.salePrice) : '',
    isOnSale: data?.isOnSale ?? false,
    quantity: data ? String(data.quantity) : '0',
    isAvailable: data?.isAvailable ?? true,
    isActive: data?.isActive ?? true,
    tags: data?.tags.join(', ') ?? '',
    metaTitle: data?.metaTitle ?? '',
    metaDescription: data?.metaDescription ?? '',
    translations: { en: tr('en'), ja: tr('ja'), ko: tr('ko'), fr: tr('fr') },
  }
}

function toInput(v: Values): AdminProductInput {
  const nullIfEmpty = (s: string) => (s.trim() ? s.trim() : null)
  return {
    name: v.name,
    code: nullIfEmpty(v.code),
    slug: nullIfEmpty(v.slug),
    categoryId: v.categoryId,
    shortDescription: nullIfEmpty(v.shortDescription),
    description: nullIfEmpty(v.description),
    price: v.price,
    salePrice: v.isOnSale && v.salePrice ? Number(v.salePrice) : null,
    isOnSale: v.isOnSale,
    quantity: v.quantity,
    isAvailable: v.isAvailable,
    isActive: v.isActive,
    tags: v.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    metaTitle: nullIfEmpty(v.metaTitle),
    metaDescription: nullIfEmpty(v.metaDescription),
    // A language without a name is "not translated yet": the storefront falls back to Vietnamese
    translations: OTHER_LANGS.filter((l) => v.translations[l].name.trim()).map((l) => ({
      languageCode: l,
      name: v.translations[l].name.trim(),
      shortDescription: nullIfEmpty(v.translations[l].shortDescription),
      description: nullIfEmpty(v.translations[l].description),
    })),
  }
}

export default function ProductEditPage() {
  const { id } = useParams()
  const productId = id ? Number(id) : null
  const { data, isPending, isError, refetch } = useAdminProduct(productId)

  if (productId !== null && isError) return <ErrorState onRetry={() => void refetch()} />
  if (productId !== null && (isPending || !data)) return <Skeleton className="h-[40rem] rounded-2xl" />
  // Remount when switching products so the form starts from the right values
  return <ProductForm key={productId ?? 'new'} product={data ?? null} />
}

function ProductForm({ product }: { product: AdminProductEdit | null }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const navigate = useNavigate()
  const save = useSaveProduct(product?.id ?? null)
  const { data: catalog } = useAdminCatalog()
  const [lang, setLang] = useState<'vi' | OtherLang>('vi')

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    getValues,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: toForm(product?.data) })

  const isOnSale = useWatch({ control, name: 'isOnSale' })
  const metaTitle = useWatch({ control, name: 'metaTitle' }) ?? ''
  const metaDescription = useWatch({ control, name: 'metaDescription' }) ?? ''
  const translations = useWatch({ control, name: 'translations' })

  // Leaving with unsaved edits asks first (in-app navigation and tab close)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && !save.isPending && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const onSubmit = (values: Values) =>
    save.mutate(toInput(values), {
      onSuccess: (saved) => {
        toast.success(product ? t('productEdit.saved') : t('productEdit.created'))
        reset(toForm(saved.data))
        if (!product) navigate(`/admin/products/${saved.id}`, { replace: true })
      },
      onError: (e) => {
        if (!applyFieldErrors(e, setError, ['name', 'code', 'slug', 'categoryId', 'price', 'salePrice', 'quantity'])) toast.error(errorMessage(tc, e))
        else toast.error(t('productEdit.fixErrors'))
      },
    })

  const err = (code: string | undefined) => fieldError(tc, code)
  const translated = (l: OtherLang) => Boolean(translations?.[l]?.name?.trim())

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Link to="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('products.title')}
      </Link>
      <PageHeader
        title={product ? product.data.name : t('productEdit.newTitle')}
        description={
          product
            ? t('productEdit.meta', { sold: f.number(product.soldCount), updated: f.dateTime(product.updatedAt) })
            : t('productEdit.newHint')
        }
        actions={
          <>
            {product ? (
              <Button variant="outline" asChild>
                <a href={`/p/${product.data.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> {t('productEdit.viewInStore')}
                </a>
              </Button>
            ) : null}
            <Button type="submit" loading={save.isPending || isSubmitting}>
              <Save /> {product ? t('productEdit.save') : t('productEdit.create')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Panel
            title={t('productEdit.content')}
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
              <AiTranslateButton
                kind="dish"
                source={() => ({ name: getValues('name'), shortDescription: getValues('shortDescription'), description: getValues('description') })}
                translated={(l) => Boolean(getValues(`translations.${l as OtherLang}.name`)?.trim())}
                onResult={(result) => {
                  // Drafts land in the form only: nothing is saved until staff press Save
                  for (const [l, values] of Object.entries(result)) {
                    if (!(OTHER_LANGS as readonly string[]).includes(l)) continue
                    for (const field of ['name', 'shortDescription', 'description'] as const) {
                      if (values[field]) setValue(`translations.${l as OtherLang}.${field}`, values[field], { shouldDirty: true })
                    }
                  }
                  const first = Object.keys(result)[0]
                  if ((OTHER_LANGS as readonly string[]).includes(first)) setLang(first as OtherLang)
                }}
              />
              <Segmented
                label={t('productEdit.language')}
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'vi' as const, label: 'VI' },
                  ...OTHER_LANGS.map((l) => ({
                    value: l,
                    label: (
                      <>
                        {l.toUpperCase()}
                        <span className={cn('size-1.5 rounded-full', translated(l) ? 'bg-success' : 'bg-muted-foreground/40')} aria-label={translated(l) ? t('productEdit.translated') : t('productEdit.notTranslated')} />
                      </>
                    ),
                  })),
                ]}
              />
              </div>
            }
          >
            {lang === 'vi' ? (
              <div className="space-y-4">
                <Field label={t('productEdit.name')} error={err(errors.name?.message)}>
                  {(fid, d) => <Input id={fid} aria-describedby={d} aria-invalid={!!errors.name} {...register('name')} />}
                </Field>
                <Field label={t('productEdit.shortDescription')} hint={t('productEdit.shortHint')} optional={tc('common.optional')} error={err(errors.shortDescription?.message)}>
                  {(fid, d) => <Textarea id={fid} aria-describedby={d} rows={2} {...register('shortDescription')} />}
                </Field>
                <Field label={t('productEdit.description')} optional={tc('common.optional')} error={err(errors.description?.message)}>
                  {(fid, d) => <Textarea id={fid} aria-describedby={d} rows={7} {...register('description')} />}
                </Field>
              </div>
            ) : (
              <div className="space-y-4" lang={lang}>
                <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                  {t('productEdit.translationHint', { language: LANGUAGES.find((l) => l.code === lang)?.label })}
                </p>
                <Field label={t('productEdit.name')} optional={tc('common.optional')} error={err(errors.translations?.[lang]?.name?.message)}>
                  {(fid, d) => <Input id={fid} aria-describedby={d} {...register(`translations.${lang}.name`)} />}
                </Field>
                <Field label={t('productEdit.shortDescription')} optional={tc('common.optional')}>
                  {(fid, d) => <Textarea id={fid} aria-describedby={d} rows={2} {...register(`translations.${lang}.shortDescription`)} />}
                </Field>
                <Field label={t('productEdit.description')} optional={tc('common.optional')}>
                  {(fid, d) => <Textarea id={fid} aria-describedby={d} rows={7} {...register(`translations.${lang}.description`)} />}
                </Field>
              </div>
            )}
          </Panel>

          {product ? (
            <ImageManager product={product} />
          ) : (
            <Panel title={t('productEdit.images')}>
              <p className="text-sm text-muted-foreground">{t('productEdit.imagesAfterCreate')}</p>
            </Panel>
          )}

          <Panel title={t('productEdit.seo')}>
            <div className="space-y-4">
              <Field label={t('productEdit.metaTitle')} hint={`${metaTitle.length}/60 · ${t('productEdit.metaTitleHint')}`} optional={tc('common.optional')} error={err(errors.metaTitle?.message)}>
                {(fid, d) => <Input id={fid} aria-describedby={d} {...register('metaTitle')} />}
              </Field>
              <Field label={t('productEdit.metaDescription')} hint={`${metaDescription.length}/160 · ${t('productEdit.metaDescriptionHint')}`} optional={tc('common.optional')} error={err(errors.metaDescription?.message)}>
                {(fid, d) => <Textarea id={fid} aria-describedby={d} rows={3} {...register('metaDescription')} />}
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={t('productEdit.visibility')}>
            <div className="space-y-3">
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <Checkbox className="mt-1" {...register('isActive')} />
                <span>
                  <span className="block text-sm font-medium">{t('productEdit.isActive')}</span>
                  <span className="block text-xs text-muted-foreground">{t('productEdit.isActiveHint')}</span>
                </span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <Checkbox className="mt-1" {...register('isAvailable')} />
                <span>
                  <span className="block text-sm font-medium">{t('productEdit.isAvailable')}</span>
                  <span className="block text-xs text-muted-foreground">{t('productEdit.isAvailableHint')}</span>
                </span>
              </label>
            </div>
          </Panel>

          <Panel title={t('productEdit.organization')}>
            <div className="space-y-4">
              <Field label={t('products.category')} error={err(errors.categoryId?.message)}>
                {(fid, d) => (
                  <Select id={fid} aria-describedby={d} aria-invalid={!!errors.categoryId} {...register('categoryId')}>
                    <option value="">{t('productEdit.chooseCategory')}</option>
                    {catalog?.map((c) => (
                      <optgroup key={c.id} label={c.name}>
                        {c.categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('productEdit.tags')} hint={t('productEdit.tagsHint')} optional={tc('common.optional')}>
                {(fid, d) => <Input id={fid} aria-describedby={d} placeholder="seafood, premium, raw" {...register('tags')} />}
              </Field>
              <Field label={t('productEdit.code')} hint={t('productEdit.codeHint')} optional={tc('common.optional')} error={err(errors.code?.message)}>
                {(fid, d) => <Input id={fid} aria-describedby={d} aria-invalid={!!errors.code} className="font-mono" {...register('code')} />}
              </Field>
              <Field label={t('productEdit.slug')} hint={t('productEdit.slugHint')} optional={tc('common.optional')} error={err(errors.slug?.message)}>
                {(fid, d) => <Input id={fid} aria-describedby={d} className="font-mono" {...register('slug')} />}
              </Field>
            </div>
          </Panel>

          <Panel title={t('productEdit.pricing')}>
            <div className="space-y-4">
              <Field label={t('productEdit.price')} error={err(errors.price?.message)}>
                {(fid, d) => <Input id={fid} aria-describedby={d} aria-invalid={!!errors.price} inputMode="numeric" {...register('price')} />}
              </Field>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <Checkbox {...register('isOnSale')} />
                <span className="text-sm font-medium">{t('productEdit.isOnSale')}</span>
              </label>
              {isOnSale ? (
                <Field label={t('productEdit.salePrice')} error={err(errors.salePrice?.message)}>
                  {(fid, d) => <Input id={fid} aria-describedby={d} aria-invalid={!!errors.salePrice} inputMode="numeric" {...register('salePrice')} />}
                </Field>
              ) : null}
              <Field label={t('productEdit.quantity')} error={err(errors.quantity?.message)}>
                {(fid, d) => <Input id={fid} aria-describedby={d} aria-invalid={!!errors.quantity} inputMode="numeric" {...register('quantity')} />}
              </Field>
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title={t('productEdit.leaveTitle')}
        text={t('productEdit.leaveText')}
        confirmLabel={t('productEdit.leave')}
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  )
}

function ImageManager({ product }: { product: AdminProductEdit }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const { upload, remove, reorder } = useProductImages(product.id)
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(0)
  const [deleting, setDeleting] = useState<number | null>(null)
  const images = useMemo(() => [...product.images].sort((a, b) => a.sortOrder - b.sortOrder), [product.images])

  const add = async (files: FileList | File[]) => {
    const list = [...files].filter((file) => file.type.startsWith('image/'))
    setPending(list.length)
    for (const file of list) {
      // One at a time keeps the order predictable and the server load low
      try {
        await upload.mutateAsync(file)
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(tc, e)}`)
      }
      setPending((n) => n - 1)
    }
  }

  const move = (index: number, delta: number) => {
    const ids = images.map((i) => i.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    reorder.mutate(ids)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) void add(e.dataTransfer.files)
  }

  return (
    <Panel title={t('productEdit.images')} action={<span className="text-xs text-muted-foreground">{t('productEdit.imagesHint')}</span>}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, i) => (
          <li key={image.id} className="group relative overflow-hidden rounded-xl border border-border bg-muted">
            <img src={image.url} alt={image.alt ?? ''} className="aspect-[4/3] w-full object-cover" loading="lazy" />
            {i === 0 ? <Badge className="absolute top-2 left-2">{t('productEdit.cover')}</Badge> : null}
            <div className="flex items-center justify-between gap-1 bg-card/95 p-1.5">
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label={t('productEdit.moveLeft')}>
                  <ChevronLeft />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" disabled={i === images.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label={t('productEdit.moveRight')}>
                  <ChevronRight />
                </Button>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" className="text-sale" onClick={() => setDeleting(image.id)} aria-label={t('productEdit.deleteImage')}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <li key={`pending-${i}`} className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-border">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-label={t('productEdit.uploading')} />
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors',
              dragging ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:border-primary/60 hover:text-foreground',
            )}
          >
            <ImagePlus className="size-6" />
            <span className="px-2 text-center">{t('productEdit.addImages')}</span>
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void add(e.target.files)
              e.target.value = ''
            }}
          />
        </li>
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('productEdit.deleteImageTitle')}
        confirmLabel={t('productEdit.deleteImage')}
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting !== null &&
          remove.mutate(deleting, {
            onSuccess: () => setDeleting(null),
            onError: (e) => toast.error(errorMessage(tc, e)),
          })
        }
      />
    </Panel>
  )
}

