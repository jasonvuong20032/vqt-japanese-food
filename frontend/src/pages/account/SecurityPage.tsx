import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useChangePassword } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { applyFieldErrors, errorMessage, fieldError } from '@/lib/errors'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'required'),
    newPassword: z.string().min(8, 'password_too_short').refine((v) => /[a-zA-ZÀ-ɏ]/.test(v) && /\d/.test(v), 'password_too_weak'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'password_mismatch', path: ['confirm'] })
type Values = z.infer<typeof schema>

export default function SecurityPage() {
  const { t } = useTranslation()
  const change = useChangePassword()
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  })

  const onSubmit = (v: Values) =>
    change.mutate(
      { currentPassword: v.currentPassword, newPassword: v.newPassword },
      {
        onSuccess: () => {
          toast.success(t('account.passwordChanged'))
          reset()
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError, ['currentPassword', 'newPassword'])) toast.error(errorMessage(t, error))
        },
      },
    )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-5 rounded-3xl border border-border bg-card p-6" noValidate>
      <h2 className="font-display text-xl font-semibold">{t('account.changePassword')}</h2>
      <Field label={t('account.currentPassword')} error={fieldError(t, errors.currentPassword?.message)}>
        {(id) => <Input id={id} type="password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...register('currentPassword')} />}
      </Field>
      <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')} error={fieldError(t, errors.newPassword?.message)}>
        {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...register('newPassword')} />}
      </Field>
      <Field label={t('account.confirmPassword')} error={fieldError(t, errors.confirm?.message)}>
        {(id) => <Input id={id} type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />}
      </Field>
      <Button type="submit" loading={change.isPending}>{t('account.changePassword')}</Button>
    </form>
  )
}
