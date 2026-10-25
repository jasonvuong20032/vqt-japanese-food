import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useForgotPassword, useResetPassword } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { errorMessage } from '@/lib/errors'
import { AuthShell } from './AuthShell'

/** Step 1: email a 6-digit code. Step 2: enter the code and a new password. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const forgot = useForgotPassword()
  const reset = useResetPassword()

  const requestCode = (e: FormEvent) => {
    e.preventDefault()
    forgot.mutate(email, {
      // Same answer whether or not the email exists, so accounts can't be discovered
      onSuccess: () => {
        toast.success(t('auth.resetSent'))
        setStep(2)
      },
      onError: (error) => toast.error(errorMessage(t, error)),
    })
  }

  const submitReset = (e: FormEvent) => {
    e.preventDefault()
    reset.mutate(
      { email, code, newPassword: password },
      {
        onSuccess: () => {
          toast.success(t('auth.resetDone'))
          navigate(`/login?email=${encodeURIComponent(email)}`, { replace: true })
        },
        onError: (error) => toast.error(errorMessage(t, error)),
      },
    )
  }

  return (
    <AuthShell kanji="再設定" title={t('auth.forgotTitle')} subtitle={step === 1 ? t('auth.forgotSubtitle') : t('auth.resetSubtitle', { email })}>
      {step === 1 ? (
        <form onSubmit={requestCode} className="space-y-5">
          <Field label={t('auth.email')}>
            {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={forgot.isPending}>{t('auth.sendCode')}</Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-primary hover:underline">← {t('nav.login')}</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-5">
          <Field label={t('auth.code')}>
            {(id) => (
              <Input id={id} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="h-14 text-center font-mono text-2xl tracking-[0.6em]" required />
            )}
          </Field>
          <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
            {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending} disabled={code.length !== 6 || password.length < 8}>{t('auth.resetSubmit')}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>{t('auth.resend')}</Button>
        </form>
      )}
    </AuthShell>
  )
}
