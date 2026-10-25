import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/misc'
import type { AdminCustomerRow } from '../types'

/** Role (when not a customer) and account state, each with a label so color is never the only cue. */
export function AccountBadges({ customer }: { customer: AdminCustomerRow }) {
  const { t } = useTranslation('admin')
  return (
    <span className="flex flex-wrap gap-1.5">
      {customer.role !== 'Customer' ? <Badge variant="info">{t(`roles.${customer.role}`)}</Badge> : null}
      {customer.isLocked ? (
        <Badge variant="danger">{t('customers.statuses.locked')}</Badge>
      ) : customer.isVerified ? (
        <Badge variant="success">{t('customers.statuses.active')}</Badge>
      ) : (
        <Badge variant="muted">{t('customers.statuses.unverified')}</Badge>
      )}
    </span>
  )
}
