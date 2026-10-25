import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { queryClient } from '@/api/client'
import { initI18n } from '@/i18n'
import { router } from '@/router'
import { useUiStore } from '@/stores/ui'
import './index.css'

await initI18n(useUiStore.getState().language)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
