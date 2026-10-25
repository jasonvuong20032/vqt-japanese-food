import type { ReactNode } from 'react'
import { useAbout } from '@/api/hooks'
import { PageMeta } from '@/components/common'

/** Two-column auth layout: form on the left, a quiet food photograph on the right. */
export function AuthShell({ title, subtitle, kanji, children }: { title: string; subtitle?: string; kanji: string; children: ReactNode }) {
  const { data: about } = useAbout()
  const image = about?.story?.image ?? about?.hero?.image
  return (
    <>
      <PageMeta title={title} />
      <div className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-6xl items-stretch gap-0 px-4 py-8 md:grid-cols-2 md:py-12">
        <div className="flex flex-col justify-center rounded-3xl border border-border bg-card p-7 sm:p-10 md:rounded-r-none">
          <span lang="ja" className="font-jp tracking-[0.35em] text-primary">{kanji}</span>
          <h1 className="mt-2 font-display text-3xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
        <div className="relative hidden overflow-hidden rounded-r-3xl bg-muted md:block">
          {image ? <img src={image} alt="" className="absolute inset-0 size-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <p lang="ja" className="absolute bottom-8 left-8 font-jp text-3xl tracking-[0.4em] text-white/90">一期一会</p>
        </div>
      </div>
    </>
  )
}
