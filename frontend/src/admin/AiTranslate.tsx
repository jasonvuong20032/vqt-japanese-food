import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { useCapabilities, useTranslate } from './api-store'
import type { TranslateKind, Translations } from './types'
import { ConfirmDialog } from './ui'

export const AI_LANGS = ['en', 'ja', 'ko', 'fr'] as const

/**
 * Drafts the missing translations with Claude and hands them to the form; staff review them before saving.
 * When every language already has text it asks before overwriting. Hidden when the server has no AI key.
 */
export function AiTranslateButton({ kind, source, translated, onResult, className }: {
  kind: TranslateKind
  /** Vietnamese text by field name */
  source: () => Record<string, string>
  /** Languages that already have a translation */
  translated: (lang: string) => boolean
  onResult: (translations: Translations) => void
  className?: string
}) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation()
  const { data: caps } = useCapabilities()
  const translate = useTranslate()
  const [confirmAll, setConfirmAll] = useState(false)

  if (!caps?.aiTranslate) return null

  const run = (targets: string[]) => {
    const fields = Object.fromEntries(Object.entries(source()).filter(([, v]) => v.trim()))
    if (Object.keys(fields).length === 0) {
      toast.error(t('ai.needSource'))
      return
    }
    translate.mutate(
      { kind, fields, targets },
      {
        onSuccess: ({ translations }) => {
          onResult(translations)
          toast.success(t('ai.done', { languages: Object.keys(translations).map((l) => l.toUpperCase()).join(', ') }))
          setConfirmAll(false)
        },
        onError: (e) => {
          toast.error(errorMessage(tc, e))
          setConfirmAll(false)
        },
      },
    )
  }

  const start = () => {
    const missing = AI_LANGS.filter((l) => !translated(l))
    if (missing.length > 0) run(missing)
    else setConfirmAll(true)
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" loading={translate.isPending} onClick={start} className={className}>
        {translate.isPending ? null : <Sparkles />} {translate.isPending ? t('ai.working') : t('ai.translate')}
      </Button>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t('ai.overwriteTitle')}
        text={t('ai.overwriteText')}
        confirmLabel={t('ai.overwrite')}
        loading={translate.isPending}
        onConfirm={() => run([...AI_LANGS])}
      />
    </>
  )
}
