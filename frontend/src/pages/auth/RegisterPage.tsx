import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useRegister } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { applyFieldErrors, errorMessage, fieldError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'
import { AuthShell } from './AuthShell'

const schema = z.object({
  fullName: z.string().trim().min(2, 'required').max(100, 'too_long'),
  email: z.string().trim().refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'invalid_email'),
  phone: z.string().refine((v) => /^(0|\+?84)\d{9}$/.test(v.replace(/[\s.-]/g, '')), 'invalid_phone'),
  password: z
    .string()
    .min(8, 'password_too_short')
    .refine((v) => /[a-zA-ZÀ-ɏ]/.test(v) && /\d/.test(v), 'password_too_weak'),
})
type Values = z.infer<typeof schema>

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const language = useUiStore((s) => s.language)
  const registerMutation = useRegister()
  const [show, setShow] = useState(false)
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  })
  const password = watch('password')
  const rules = [
    { ok: password.length >= 8, label: t('auth.ruleLength') },
    { ok: /[a-zA-ZÀ-ɏ]/.test(password), label: t('auth.ruleLetter') },
    { ok: /\d/.test(password), label: t('auth.ruleNumber') },
  ]

  const onSubmit = (values: Values) =>
    registerMutation.mutate(
      { ...values, language },
      {
        onSuccess: ({ email }) => {
          toast.success(t('auth.codeSent', { email }))
          navigate(`/activate?email=${encodeURIComponent(email)}`)
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError, ['fullName', 'email', 'phone', 'password'])) toast.error(errorMessage(t, error))
        },
      },
    )

  return (
    <AuthShell kanji="ようこそ" title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label={t('checkout.fullName')} error={fieldError(t, errors.fullName?.message)}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.fullName} autoComplete="name" {...register('fullName')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.email')} error={fieldError(t, errors.email?.message)}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" {...register('email')} />}
          </Field>
          <Field label={t('checkout.phone')} error={fieldError(t, errors.phone?.message)}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.phone} type="tel" autoComplete="tel" {...register('phone')} />}
          </Field>
        </div>
        <Field label={t('auth.password')} error={fieldError(t, errors.password?.message)}>
          {(id, d) => (
            <div className="relative">
              <Input id={id} aria-describedby={d} aria-invalid={!!errors.password} type={show ? 'text' : 'password'} autoComplete="new-password" className="pr-11" {...register('password')} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {rules.map((r) => (
            <li key={r.label} className={cn('flex items-center gap-1', r.ok ? 'text-success' : 'text-muted-foreground')}>
              <Check className="size-3.5" /> {r.label}
            </li>
          ))}
        </ul>
        <Button type="submit" size="lg" className="w-full" loading={registerMutation.isPending}>{t('auth.createAccount')}</Button>
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.haveAccount')} <Link to="/login" className="font-semibold text-primary hover:underline">{t('nav.login')}</Link>
        </p>
      </form>
    </AuthShell>
  )
}
