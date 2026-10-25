import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useActivate, useResendActivation } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { errorMessage } from '@/lib/errors'
import { AuthShell } from './AuthShell'

export default function ActivatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const activate = useActivate()
  const resend = useResendActivation()

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    activate.mutate(
      { email, code },
      {
        onSuccess: (user) => {
          toast.success(t('auth.activated', { name: user.fullName }))
          navigate('/', { replace: true })
        },
        onError: (error) => toast.error(errorMessage(t, error)),
      },
    )
  }

  const onResend = () =>
    resend.mutate(email, {
      onSuccess: () => {
        toast.success(t('auth.codeSent', { email }))
        setCooldown(60)
      },
      onError: (error) => toast.error(errorMessage(t, error)),
    })

  return (
    <AuthShell kanji="確認" title={t('auth.activateTitle')} subtitle={t('auth.activateSubtitle')}>
      <form onSubmit={submit} className="space-y-5">
        <Field label={t('auth.email')}>
          {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label={t('auth.code')} hint={t('auth.codeHint')}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              className="h-14 text-center font-mono text-2xl tracking-[0.6em]"
              required
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={activate.isPending} disabled={code.length !== 6 || !email}>
          {t('auth.activate')}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onResend} disabled={!email || cooldown > 0} loading={resend.isPending}>
          {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
        </Button>
      </form>
    </AuthShell>
  )
}
