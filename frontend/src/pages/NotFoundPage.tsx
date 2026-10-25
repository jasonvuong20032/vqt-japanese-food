import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Container, PageMeta } from '@/components/common'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageMeta title={t('notFound.title')} />
      <Container className="py-24 text-center">
        <p lang="ja" className="font-jp text-7xl text-primary/80">迷子</p>
        <h1 className="mt-6 font-display text-3xl font-semibold">{t('notFound.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('notFound.text')}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link to="/">{t('nav.home')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/menu">{t('nav.menu')}</Link>
          </Button>
        </div>
      </Container>
    </>
  )
}

/** Shown when a route throws (e.g. a lazy chunk failed to load after a deploy). */
export function RouteError() {
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : undefined
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
      <div>
        <p className="font-display text-5xl font-semibold">{status ?? 'Oops'}</p>
        <p className="mt-3 text-muted-foreground">Something went wrong. Đã có lỗi xảy ra.</p>
        <button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground">
          Reload / Tải lại
        </button>
      </div>
    </div>
  )
}
