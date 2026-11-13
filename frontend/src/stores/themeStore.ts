import { create } from 'zustand'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('pos_theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // abaikan jika penyimpanan browser tidak tersedia
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

type ThemeState = {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const theme = initialTheme()
  applyTheme(theme)

  return {
    theme,
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('pos_theme', next)
      } catch {
        // abaikan
      }
      applyTheme(next)
      set({ theme: next })
    },
  }
})