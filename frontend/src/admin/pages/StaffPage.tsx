import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useMe } from '@/api/hooks'
import { ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/form'
import { Badge, Skeleton } from '@/components/ui/misc'
import { errorMessage } from '@/lib/errors'
import { useFormat } from '@/lib/format'
import { AdminOnly } from '../AdminLayout'
import { useAddStaff, useCustomers, useSetRole } from '../api-store'
import type { AdminCustomerRow, Role } from '../types'
import { ConfirmDialog, PageHeader, Panel } from '../ui'

export default function StaffPage() {
  return (
    <AdminOnly>
      <Staff />
    </AdminOnly>
  )
}

function Staff() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const f = useFormat()
  const { data: me } = useMe()
  const { data, isPending, isError, refetch } = useCustomers({ role: 'staff', sort: 'name', pageSize: 100 })
  const add = useAddStaff()
  const setRole = useSetRole()
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('Staff')
  const [pending, setPending] = useState<{ member: AdminCustomerRow; role: Role } | null>(null)

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  const confirmChange = () =>
    pending &&
    setRole.mutate(
      { id: pending.member.id, role: pending.role },
      {
        onSuccess: () => {
          toast.success(pending.role === 'Customer' ? t('staff.removed', { name: pending.member.fullName }) : t('customers.roleChanged'))
          setPending(null)
        },
        onError: (e) => {
          toast.error(errorMessage(tc, e))
          setPending(null)
        },
      },
    )

  return (
    <>
      <PageHeader title={t('staff.title')} description={t('staff.subtitle')} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="min-w-0 relative overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('staff.member')}</th>
                <th className="px-4 py-3 font-medium">{t('customers.role')}</th>
                <th className="px-4 py-3 font-medium">{t('customers.status')}</th>
                <th className="px-4 py-3 font-medium">{t('customers.joined')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending
                ? Array.from({ length: 3 }, (_, i) => <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-9" /></td></tr>)
                : data?.items.map((m) => {
                    const self = m.id === me?.id
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3">
                          <Link to={`/admin/customers/${m.id}`} className="font-medium hover:text-primary">{m.fullName}</Link>
                          {self ? <Badge variant="outline" className="ml-2">{t('staff.you')}</Badge> : null}
                          <span className="block text-xs text-muted-foreground">{m.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <label>
                            <span className="sr-only">{t('customers.role')}</span>
                            <Select
                              className="h-9 w-40"
                              value={m.role}
                              disabled={self}
                              onChange={(e) => setPending({ member: m, role: e.target.value as Role })}
                            >
                              <option value="Admin">{t('roles.Admin')}</option>
                              <option value="Staff">{t('roles.Staff')}</option>
                              <option value="Customer">{t('staff.removeOption')}</option>
                            </Select>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          {m.isLocked ? <Badge variant="danger">{t('customers.statuses.locked')}</Badge> : <Badge variant="success">{t('customers.statuses.active')}</Badge>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{f.date(m.createdAt)}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </section>

        <Panel title={t('staff.add')}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              add.mutate(
                { email: email.trim(), role: newRole },
                {
                  onSuccess: () => {
                    toast.success(t('staff.added', { email: email.trim() }))
                    setEmail('')
                  },
                  onError: (err) => toast.error(errorMessage(tc, err)),
                },
              )
            }}
          >
            <Field label={t('orders.email')} hint={t('staff.addHint')}>
              {(id, d) => <Input id={id} aria-describedby={d} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
            </Field>
            <Field label={t('customers.role')}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  <option value="Staff">{t('roles.Staff')}</option>
                  <option value="Admin">{t('roles.Admin')}</option>
                </Select>
              )}
            </Field>
            <Button type="submit" className="w-full" loading={add.isPending} disabled={!email.trim()}>
              <UserPlus /> {t('staff.addButton')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('staff.roleHelp')}</p>
          </form>
        </Panel>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.role === 'Customer'
            ? t('staff.removeTitle', { name: pending.member.fullName })
            : t('customers.confirmRole', { name: pending?.member.fullName ?? '', role: pending ? t(`roles.${pending.role}`) : '' })
        }
        text={t('customers.roleText')}
        confirmLabel={t('orders.confirm')}
        destructive={pending?.role === 'Customer'}
        loading={setRole.isPending}
        onConfirm={confirmChange}
      />
    </>
  )
}
