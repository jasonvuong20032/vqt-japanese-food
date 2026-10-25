import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCatalog, useStore } from '@/api/hooks'
import { Logo } from './Header'

export function Footer() {
  const { t } = useTranslation()
  const { data: store } = useStore()
  const { data: catalog } = useCatalog()
  const info = store?.info
  const year = new Date().getFullYear()

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-border bg-card">
      <div className="pattern-seigaiha pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t('footer.about')}</p>
          <p className="font-jp text-sm tracking-[0.3em] text-primary" lang="ja" aria-hidden>
            一期一会
          </p>
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">{t('nav.menu')}</h2>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {catalog?.map((c) => (
              <li key={c.id}>
                <Link to={`/menu/${c.slug}`} className="hover:text-primary">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">{t('footer.customerCare')}</h2>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link to="/track" className="hover:text-primary">{t('nav.track')}</Link></li>
            <li><Link to="/policies" className="hover:text-primary">{t('nav.policies')}</Link></li>
            <li><Link to="/about" className="hover:text-primary">{t('nav.about')}</Link></li>
            <li><Link to="/account/orders" className="hover:text-primary">{t('nav.orders')}</Link></li>
            <li><Link to="/credits" className="hover:text-primary">{t('nav.credits')}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">{t('footer.contact')}</h2>
          {info ? (
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2.5"><Phone className="mt-0.5 size-4 shrink-0 text-primary" /><a href={`tel:${info.phone.replace(/\s/g, '')}`} className="hover:text-primary">{info.phone}</a></li>
              <li className="flex gap-2.5"><Mail className="mt-0.5 size-4 shrink-0 text-primary" /><a href={`mailto:${info.email}`} className="break-all hover:text-primary">{info.email}</a></li>
              <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{info.address}</li>
              <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0 text-primary" />{t('footer.hours', { hours: info.openingHours })}</li>
            </ul>
          ) : null}
        </div>
      </div>
      <div className="relative border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} {t('brand.name')}. {t('footer.rights')}</p>
          <p>{t('footer.alcohol')}</p>
        </div>
      </div>
    </footer>
  )
}
