import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function AdminNotFound() {
  const { t } = useTranslation('admin')
  return (
    <div className="py-24 text-center">
      <p className="font-display text-5xl font-semibold text-muted-foreground">404</p>
      <p className="mt-3 text-muted-foreground">{t('notFound')}</p>
      <Button asChild className="mt-6">
        <Link to="/admin">{t('nav.dashboard')}</Link>
      </Button>
    </div>
  )
}
