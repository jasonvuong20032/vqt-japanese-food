import { useState } from 'react'
import { ArrowLeft, Lock, LockOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { useMe } from '@/api/hooks'
import { ErrorState } from '@/components/common'
import { StatusBadge } from '@/components/order/OrderParts'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { LANGUAGES } from '@/lib/utils'
import { useCustomer, useLockCustomer, useSetRole } from '../api-store'
import type { Role } from '../types'
import { ConfirmDialog, Panel, StatTile } from '../ui'
import { AccountBadges } from './customerParts'

const ROLES: Role[] = ['Customer', 'Staff', 'Admin']

export default function CustomerDetailPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const id = Number(useParams().id)
  const { data, isPending, isError, refetch } = useCustomer(id)
  const { data: me } = useMe()
  const lock = useLockCustomer()
  const setRole = useSetRole()
  const [confirm, setConfirm] = useState<null | { kind: 'lock' | 'unlock' } | { kind: 'role'; role: Role }>(null)
  const [role, setRoleDraft] = useState<Role | null>(null)

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isPending || !data) return <Skeleton className="h-96 rounded-2xl" />

  const c = data.customer
  const isAdmin = me?.role === 'Admin'
  const isSelf = me?.id === c.id
  const chosenRole = role ?? c.role
  const language = LANGUAGES.find((l) => l.code === data.preferredLanguage)?.label

  const run = () => {
    if (!confirm) return
    const done = (message: string) => {
      toast.success(message)
      setConfirm(null)
      setRoleDraft(null)
    }
    const failed = (e: unknown) => {
      toast.error(errorMessage(tc, e))
      setConfirm(null)
    }
    if (confirm.kind === 'role') setRole.mutate({ id: c.id, role: confirm.role }, { onSuccess: () => done(t('customers.roleChanged')), onError: failed })
    else lock.mutate({ id: c.id, locked: confirm.kind === 'lock' }, { onSuccess: () => done(t(confirm.kind === 'lock' ? 'customers.locked' : 'customers.unlocked')), onError: failed })
  }

  return (
    <>
      <Link to="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('customers.title')}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{c.fullName}</h1>
        <AccountBadges customer={c} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('customers.orders')} value={f.number(c.orderCount)} />
        <StatTile label={t('customers.spent')} value={f.money(c.totalSpent)} hint={t('customers.spentHint')} />
        <StatTile label={t('customers.lastOrder')} value={c.lastOrderAt ? f.date(c.lastOrderAt) : '—'} />
        <StatTile label={t('customers.joined')} value={f.date(c.createdAt)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('customers.contact')}>
          <dl className="space-y-2 text-sm">
            <div className="grid grid-cols-[6rem_1fr] gap-2"><dt className="text-muted-foreground">{t('orders.email')}</dt><dd className="break-all"><a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a></dd></div>
            <div className="grid grid-cols-[6rem_1fr] gap-2"><dt className="text-muted-foreground">{t('orders.phone')}</dt><dd>{c.phone ? <a href={`tel:${c.phone}`} className="text-primary hover:underline">{c.phone}</a> : '—'}</dd></div>
            <div className="grid grid-cols-[6rem_1fr] gap-2"><dt className="text-muted-foreground">{t('customers.language')}</dt><dd>{language ?? '—'}</dd></div>
          </dl>
        </Panel>

        <Panel title={t('customers.addresses')}>
          {data.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('customers.noAddresses')}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {data.addresses.map((a) => (
                <li key={a.id}>
                  <span className="flex items-center gap-2 font-medium">{a.fullName} {a.isDefault ? <Badge variant="muted">{t('customers.default')}</Badge> : null}</span>
                  <span className="block text-muted-foreground">{a.phone}</span>
                  <span className="block text-muted-foreground">{[a.street, a.ward, a.province].filter(Boolean).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('customers.account')}>
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">{t('customers.adminOnly')}</p>
          ) : isSelf ? (
            <p className="text-sm text-muted-foreground">{t('customers.self')}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="role" className="mb-1.5 block text-sm font-medium">{t('customers.role')}</label>
                <div className="flex gap-2">
                  <Select id="role" value={chosenRole} onChange={(e) => setRoleDraft(e.target.value as Role)}>
                    {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                  </Select>
                  <Button variant="outline" disabled={chosenRole === c.role} onClick={() => setConfirm({ kind: 'role', role: chosenRole })}>
                    {t('customers.apply')}
                  </Button>
                </div>
              </div>
              {c.isLocked ? (
                <Button variant="outline" className="w-full" onClick={() => setConfirm({ kind: 'unlock' })}>
                  <LockOpen /> {t('customers.unlock')}
                </Button>
              ) : (
                <Button variant="destructive" className="w-full" onClick={() => setConfirm({ kind: 'lock' })}>
                  <Lock /> {t('customers.lock')}
                </Button>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t('customers.recentOrders')} className="mt-4" bodyClassName="p-0">
        {data.recentOrders.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('customers.noOrders')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentOrders.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <span className="font-mono text-sm font-semibold">{o.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{o.firstProductName} · {f.dateTime(o.createdAt)}</span>
                  <StatusBadge status={o.status} />
                  <span className="w-28 text-right text-sm font-semibold tabular-nums">{f.money(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === 'role'
            ? t('customers.confirmRole', { name: c.fullName, role: t(`roles.${confirm.role}`) })
            : t(confirm?.kind === 'lock' ? 'customers.confirmLock' : 'customers.confirmUnlock', { name: c.fullName })
        }
        text={confirm?.kind === 'lock' ? t('customers.lockText') : confirm?.kind === 'role' ? t('customers.roleText') : undefined}
        confirmLabel={t('orders.confirm')}
        destructive={confirm?.kind === 'lock' || (confirm?.kind === 'role' && confirm.role !== 'Customer')}
        loading={lock.isPending || setRole.isPending}
        onConfirm={run}
      />
    </>
  )
}
