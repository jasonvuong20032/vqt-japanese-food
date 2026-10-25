import type { TFunction } from 'i18next'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import i18n from 'i18next'
import { ApiError } from '@/api/client'

/** Human message for any error, translated from the API's stable error code. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`
    if (i18n.exists(key)) return t(key)
    if (error.status >= 500) return t('errors.server_error')
  }
  return t('errors.unknown')
}

/**
 * Copies field-level problems from a "validation_failed" response onto the form.
 * Returns true when at least one field was flagged (so the caller can skip a generic toast).
 */
export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]): boolean {
  if (!(error instanceof ApiError) || error.code !== 'validation_failed' || !error.details) return false
  let applied = false
  for (const [field, code] of Object.entries(error.details)) {
    const name = fields.find((f) => f.toLowerCase() === field.toLowerCase())
    if (!name) continue
    setError(name as Path<T>, { type: 'server', message: String(Array.isArray(code) ? code[0] : code) })
    applied = true
  }
  return applied
}

/** Translates a field error code ("invalid_phone") with a readable fallback. */
export function fieldError(t: TFunction, code: string | undefined) {
  if (!code) return undefined
  const key = `fieldErrors.${code}`
  return i18n.exists(key) ? t(key) : code
}
