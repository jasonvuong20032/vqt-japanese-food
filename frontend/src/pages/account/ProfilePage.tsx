import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useProfile, useUpdateProfile } from '@/api/hooks'
import { ThemeTiles } from '@/components/layout/Menus'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/misc'
import { applyFieldErrors, errorMessage, fieldError } from '@/lib/errors'
import { cn, LANGUAGES } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'

const schema = z.object({
  fullName: z.string().trim().min(2, 'required').max(100, 'too_long'),
  phone: z.string().refine((v) => /^(0|\+?84)\d{9}$/.test(v.replace(/[\s.-]/g, '')), 'invalid_phone'),
  birthDate: z.string(),
  gender: z.string(),
  address: z.string().max(250, 'too_long'),
})
type Values = z.infer<typeof schema>

export default function ProfilePage() {
  const { t } = useTranslation()
  const { data: profile, isLoading } = useProfile()
  const update = useUpdateProfile()
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const { register, handleSubmit, reset, setError, formState: { errors, isDirty } } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!profile) return
    reset({
      fullName: profile.user.fullName,
      phone: profile.user.phone ?? '',
      birthDate: profile.birthDate ? profile.birthDate.slice(0, 10) : '',
      gender: String(profile.gender ?? 0),
      address: profile.user.address ?? '',
    })
  }, [profile, reset])

  if (isLoading || !profile) return <Skeleton className="h-96 rounded-3xl" />

  const onSubmit = (v: Values) =>
    update.mutate(
      { fullName: v.fullName, phone: v.phone, birthDate: v.birthDate || null, gender: Number(v.gender), address: v.address },
      {
        onSuccess: () => toast.success(t('account.saved')),
        onError: (error) => {
          if (!applyFieldErrors(error, setError, ['fullName', 'phone', 'address'])) toast.error(errorMessage(t, error))
        },
      },
    )

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-3xl border border-border bg-card p-6" noValidate>
        <h2 className="font-display text-xl font-semibold">{t('account.profile')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('checkout.fullName')} error={fieldError(t, errors.fullName?.message)}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.fullName} {...register('fullName')} />}
          </Field>
          <Field label={t('auth.email')}>{(id) => <Input id={id} value={profile.user.email} disabled readOnly />}</Field>
          <Field label={t('checkout.phone')} error={fieldError(t, errors.phone?.message)}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.phone} type="tel" {...register('phone')} />}
          </Field>
          <Field label={t('account.birthDate')} optional={t('common.optional')}>
            {(id) => <Input id={id} type="date" {...register('birthDate')} />}
          </Field>
          <Field label={t('account.gender')}>
            {(id) => (
              <Select id={id} {...register('gender')}>
                <option value="0">{t('account.genderNone')}</option>
                <option value="1">{t('account.male')}</option>
                <option value="2">{t('account.female')}</option>
                <option value="3">{t('account.other')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('account.address')} optional={t('common.optional')} error={fieldError(t, errors.address?.message)}>
            {(id) => <Input id={id} {...register('address')} />}
          </Field>
        </div>
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>{t('common.save')}</Button>
      </form>

      <section className="space-y-5 rounded-3xl border border-border bg-card p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">{t('account.preferences')}</h2>
          <p className="text-sm text-muted-foreground">{t('account.preferencesHint')}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t('language.label')}</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                lang={l.code}
                onClick={() => setLanguage(l.code)}
                className={cn('rounded-full border px-4 py-2 text-sm', language === l.code ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50')}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-w-md">
          <p className="mb-2 text-sm font-medium">{t('theme.label')}</p>
          <ThemeTiles />
        </div>
      </section>
    </div>
  )
}
