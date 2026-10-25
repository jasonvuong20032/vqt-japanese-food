import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useLogin, useMe } from '@/api/hooks'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input } from '@/components/ui/form'
import { errorMessage, fieldError } from '@/lib/errors'
import { safeRedirect } from '@/lib/utils'
import { AuthShell } from './AuthShell'

const schema = z.object({
  email: z.string().trim().min(1, 'required').refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'invalid_email'),
  password: z.string().min(1, 'required'),
  rememberMe: z.boolean(),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const { data: me } = useMe()
  const login = useLogin()
  const [show, setShow] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get('email') ?? '', password: '', rememberMe: true },
  })

  if (me) return <Navigate to={redirect} replace />

  const onSubmit = (values: Values) =>
    login.mutate(values, {
      onSuccess: (user) => {
        toast.success(t('auth.welcome', { name: user.fullName }))
        navigate(redirect, { replace: true })
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'account_not_active') {
          toast(t('errors.account_not_active'))
          navigate(`/activate?email=${encodeURIComponent(values.email)}`)
          return
        }
        toast.error(errorMessage(t, error))
      },
    })

  return (
    <AuthShell kanji="おかえりなさい" title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field label={t('auth.email')} error={fieldError(t, errors.email?.message)}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label={t('auth.password')} error={fieldError(t, errors.password?.message)}>
          {(id, d) => (
            <div className="relative">
              <Input id={id} aria-describedby={d} aria-invalid={!!errors.password} type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-11" {...register('password')} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox {...register('rememberMe')} /> {t('auth.remember')}
          </label>
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">{t('auth.forgot')}</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>{t('nav.login')}</Button>
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link to={`/register${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-primary hover:underline">{t('nav.register')}</Link>
        </p>
      </form>
    </AuthShell>
  )
}
