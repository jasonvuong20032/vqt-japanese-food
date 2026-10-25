import { zodResolver } from '@hookform/resolvers/zod'
import { Banknote, Check, Lock, MapPin, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAddresses, useCartQuote, useMe, usePlaceOrder } from '@/api/hooks'
import type { Address } from '@/api/types'
import { CouponForm, Totals } from '@/components/cart/CartParts'
import { Container, PageMeta } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { Badge, EmptyState, Skeleton } from '@/components/ui/misc'
import { ApiError } from '@/api/client'
import { applyFieldErrors, errorMessage, fieldError } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { PROVINCES } from '@/lib/provinces'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/stores/cart'

const PHONE = /^(0|\+?84)\d{9}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schema = z.object({
  fullName: z.string().trim().min(2, 'required').max(100, 'too_long'),
  phone: z.string().refine((v) => PHONE.test(v.replace(/[\s.-]/g, '')), 'invalid_phone'),
  email: z.string().trim().refine((v) => v === '' || EMAIL.test(v), 'invalid_email'),
  province: z.string().min(1, 'required'),
  ward: z.string().trim().max(100, 'too_long'),
  street: z.string().trim().min(3, 'required').max(250, 'too_long'),
  note: z.string().max(500, 'too_long'),
})

type FormValues = z.infer<typeof schema>
const FIELDS = ['fullName', 'phone', 'email', 'province', 'ward', 'street', 'note'] as const

export default function CheckoutPage() {
  const { t } = useTranslation()
  const f = useFormat()
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const couponCode = useCartStore((s) => s.couponCode)
  const clear = useCartStore((s) => s.clear)
  const { data: me } = useMe()
  const { data: addresses } = useAddresses(!!me)
  const { data: quote, refetch: refetchQuote } = useCartQuote()
  const placeOrder = usePlaceOrder()
  const [selectedAddress, setSelectedAddress] = useState<number | 'new'>('new')

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', phone: '', email: '', province: 'Hồ Chí Minh', ward: '', street: '', note: '' },
  })

  const fill = (a: Address) =>
    reset((v) => ({ ...v, fullName: a.fullName, phone: a.phone, province: a.province ?? v.province, ward: a.ward ?? '', street: a.street }))

  // Prefill from the account: default address first, otherwise the profile
  useEffect(() => {
    if (!me) return
    const preferred = addresses?.find((a) => a.isDefault) ?? addresses?.[0]
    if (preferred) {
      setSelectedAddress(preferred.id)
      fill(preferred)
    } else {
      reset((v) => ({ ...v, fullName: v.fullName || me.fullName, phone: v.phone || (me.phone ?? ''), email: me.email }))
    }
  }, [me, addresses])

  if (items.length === 0) {
    return (
      <Container className="py-10">
        <EmptyState icon={<ShoppingBag />} title={t('cart.empty')} text={t('cart.emptyHint')} action={<Button asChild><Link to="/menu">{t('cart.browseMenu')}</Link></Button>} />
      </Container>
    )
  }

  const onSubmit = (values: FormValues) => {
    placeOrder.mutate(
      {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        fullName: values.fullName,
        phone: values.phone,
        email: me ? undefined : values.email || undefined,
        province: values.province,
        ward: values.ward || undefined,
        street: values.street,
        note: values.note || undefined,
        couponCode,
        paymentMethod: 0,
      },
      {
        onSuccess: (order) => {
          clear()
          navigate(`/order-success/${order.code}`, { replace: true, state: { total: order.total, phone: values.phone } })
        },
        onError: (error) => {
          if (applyFieldErrors(error, setError, FIELDS)) return
          if (error instanceof ApiError && ['insufficient_stock', 'product_unavailable'].includes(error.code)) void refetchQuote()
          toast.error(errorMessage(t, error))
        },
      },
    )
  }

  const err = (name: keyof FormValues) => fieldError(t, errors[name]?.message)

  return (
    <>
      <PageMeta title={t('checkout.title')} />
      <Container className="py-8 md:py-12">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" /> {t('checkout.secure')}
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('checkout.title')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]" noValidate>
          <div className="space-y-8">
            {!me ? (
              <p className="rounded-2xl bg-muted px-5 py-4 text-sm">
                {t('checkout.haveAccount')}{' '}
                <Link to="/login?redirect=/checkout" className="font-semibold text-primary hover:underline">{t('nav.login')}</Link>
              </p>
            ) : null}

            <section className="space-y-5 rounded-3xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">1</span> {t('checkout.contact')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('checkout.fullName')} error={err('fullName')}>
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.fullName} autoComplete="name" {...register('fullName')} />}
                </Field>
                <Field label={t('checkout.phone')} error={err('phone')}>
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" {...register('phone')} />}
                </Field>
                {!me ? (
                  <Field label={t('checkout.email')} optional={t('common.optional')} hint={t('checkout.emailHint')} error={err('email')} className="sm:col-span-2">
                    {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" {...register('email')} />}
                  </Field>
                ) : null}
              </div>
            </section>

            <section className="space-y-5 rounded-3xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">2</span> {t('checkout.address')}
              </h2>

              {addresses?.length ? (
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('checkout.savedAddresses')}>
                  {addresses.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      role="radio"
                      aria-checked={selectedAddress === a.id}
                      onClick={() => {
                        setSelectedAddress(a.id)
                        fill(a)
                      }}
                      className={cn('rounded-2xl border p-4 text-left text-sm transition', selectedAddress === a.id ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/40')}
                    >
                      <span className="flex items-center justify-between font-semibold">
                        {a.fullName} {a.isDefault ? <Badge variant="muted">{t('account.default')}</Badge> : null}
                      </span>
                      <span className="block text-muted-foreground">{a.phone}</span>
                      <span className="mt-1 flex gap-1.5 text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" /> {[a.street, a.ward, a.province].filter(Boolean).join(', ')}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedAddress === 'new'}
                    onClick={() => setSelectedAddress('new')}
                    className={cn('rounded-2xl border border-dashed p-4 text-sm font-medium', selectedAddress === 'new' ? 'border-primary text-primary' : 'border-border')}
                  >
                    + {t('checkout.newAddress')}
                  </button>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('checkout.province')} error={err('province')}>
                  {(id, d) => (
                    <Select id={id} aria-describedby={d} aria-invalid={!!errors.province} {...register('province')}>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t('checkout.ward')} optional={t('common.optional')} error={err('ward')}>
                  {(id, d) => <Input id={id} aria-describedby={d} placeholder={t('checkout.wardPlaceholder')} {...register('ward')} />}
                </Field>
                <Field label={t('checkout.street')} error={err('street')} className="sm:col-span-2">
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.street} autoComplete="street-address" placeholder={t('checkout.streetPlaceholder')} {...register('street')} />}
                </Field>
                <Field label={t('checkout.note')} optional={t('common.optional')} error={err('note')} className="sm:col-span-2">
                  {(id, d) => <Textarea id={id} aria-describedby={d} placeholder={t('checkout.notePlaceholder')} {...register('note')} />}
                </Field>
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">3</span> {t('checkout.payment')}
              </h2>
              <div className="grid gap-3">
                <div className="flex items-center gap-4 rounded-2xl border border-primary p-4 ring-2 ring-primary/25">
                  <Banknote className="size-6 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold">{t('order.payment.0')}</p>
                    <p className="text-sm text-muted-foreground">{t('checkout.codHint')}</p>
                  </div>
                  <Check className="size-5 text-primary" />
                </div>
                {['VNPay', 'MoMo'].map((m) => (
                  <div key={m} className="flex items-center gap-4 rounded-2xl border border-border p-4 opacity-60" aria-disabled>
                    <span className="grid size-6 place-items-center text-xs font-bold">{m.slice(0, 2)}</span>
                    <p className="flex-1 font-semibold">{m}</p>
                    <Badge variant="muted">{t('checkout.comingSoon')}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="space-y-5 rounded-3xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">{t('cart.summary')}</h2>
              <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {items.map((item) => {
                  const line = quote?.lines.find((l) => l.productId === item.productId)
                  return (
                    <li key={item.productId} className="flex items-center gap-3 text-sm">
                      <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="size-full object-cover" /> : null}
                        <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">{item.quantity}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium">{line?.name || item.name}</span>
                        {line?.problem ? <span className="text-xs text-sale">{t(`cart.problem.${line.problem === 'insufficient_stock' ? 'insufficient' : line.problem === 'out_of_stock' ? 'outOfStock' : 'unavailable'}`, { count: line.availableStock })}</span> : null}
                      </span>
                      <span className="font-medium tabular-nums">{f.money(line?.lineTotal ?? item.price * item.quantity)}</span>
                    </li>
                  )
                })}
              </ul>
              <CouponForm quote={quote} />
              {quote ? <Totals quote={quote} /> : <Skeleton className="h-28" />}
              <Button type="submit" size="lg" className="w-full" loading={placeOrder.isPending} disabled={!quote?.canCheckout}>
                {t('checkout.placeOrder')} {quote ? `· ${f.money(quote.total)}` : ''}
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t('checkout.agree')}</p>
            </div>
          </aside>
        </form>
      </Container>
    </>
  )
}
