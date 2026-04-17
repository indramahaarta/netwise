'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { UISettingsProvider } from '@/context/ui-settings'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <UISettingsProvider>{children}</UISettingsProvider>
    </QueryClientProvider>
  )
}
