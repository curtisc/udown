'use client'

import { useTheme } from './theme-provider'

const labels: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    if (theme === 'system') setTheme('dark')
    else if (theme === 'dark') setTheme('light')
    else setTheme('system')
  }

  return (
    <button
      onClick={cycle}
      className="rounded-lg px-2 py-1 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
      aria-label={`Theme: ${theme}. Click to change.`}
    >
      {labels[theme]}
    </button>
  )
}
