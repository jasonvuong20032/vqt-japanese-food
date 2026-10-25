import { QueryClient } from '@tanstack/react-query'
import { useUiStore } from '@/stores/ui'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

type RefreshResult = 'ok' | 'retry' | 'failed'
let refreshing: Promise<RefreshResult> | null = null

/**
 * One refresh at a time per tab: concurrent 401s share the same promise.
 * 409 = another tab already rotated the token and the browser holds the new cookies, so just retry.
 */
export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r): RefreshResult => (r.ok ? 'ok' : r.status === 409 ? 'retry' : 'failed'))
    .catch((): RefreshResult => 'failed')
    .finally(() => setTimeout(() => (refreshing = null), 0))
  return refreshing
}

interface Options {
  method?: string
  body?: unknown
  formData?: FormData
  signal?: AbortSignal
  /** Don't try to refresh the session on 401 (used by auth endpoints themselves). */
  skipAuthRetry?: boolean
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': useUiStore.getState().language,
  }
  let body: BodyInit | undefined
  if (options.formData) body = options.formData
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const send = () =>
    fetch(path, { method: options.method ?? 'GET', headers, body, signal: options.signal, credentials: 'same-origin' })

  let response: Response
  try {
    response = await send()
    if (response.status === 401 && !options.skipAuthRetry && !path.startsWith('/api/auth/')) {
      const refreshed = await refreshSession()
      if (refreshed === 'failed') {
        queryClient.setQueryData(['me'], null)
      } else {
        response = await send()
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(0, 'network', 'Network error')
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = undefined
    }
  }

  if (!response.ok) throw problemToError(response, data)

  return data as T
}

function problemToError(response: Response, data: unknown) {
  const problem = (data ?? {}) as { code?: string; title?: string; details?: Record<string, unknown>; errors?: Record<string, unknown> }
  const fallback =
    response.status === 404 ? 'not_found' : response.status === 401 ? 'unauthorized' : response.status === 429 ? 'rate_limited' : response.status >= 500 ? 'server_error' : 'unknown'
  return new ApiError(response.status, problem.code ?? fallback, problem.title ?? response.statusText, problem.details ?? problem.errors)
}

/** Builds "?a=1&b=2" from an object, skipping empty values. */
export function toQueryString(params: object) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}
