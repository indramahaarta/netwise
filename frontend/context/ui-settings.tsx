'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface UISettings {
  darkMode: boolean
  toggleDarkMode: () => void
  unseen: boolean
  toggleUnseen: () => void
}

const UISettingsContext = createContext<UISettings>({
  darkMode: false,
  toggleDarkMode: () => {},
  unseen: false,
  toggleUnseen: () => {},
})

export function UISettingsProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false)
  const [unseen, setUnseen] = useState(false)

  // Read persisted preferences after mount to avoid SSR mismatch.
  useEffect(() => {
    setDarkMode(localStorage.getItem('darkMode') === 'true')
    setUnseen(localStorage.getItem('unseen') === 'true')
  }, [])

  // Sync dark class on <html> whenever darkMode changes.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('unseen', String(unseen))
  }, [unseen])

  return (
    <UISettingsContext.Provider
      value={{
        darkMode,
        toggleDarkMode: () => setDarkMode((v) => !v),
        unseen,
        toggleUnseen: () => setUnseen((v) => !v),
      }}
    >
      {children}
    </UISettingsContext.Provider>
  )
}

export const useUISettings = () => useContext(UISettingsContext)

/**
 * Returns a currency formatter that respects the unseen toggle.
 * When unseen is active, amounts are replaced with ••••.
 * Percentages are intentionally NOT routed through this hook.
 */
export function useAmount() {
  const { unseen } = useUISettings()
  return (value: string | number, currency: string): string => {
    if (unseen) return '••••'
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(num)
  }
}
