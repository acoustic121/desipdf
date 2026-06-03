import { create } from 'zustand'

export const useStore = create((set) => ({
  language: 'en',
  theme: 'light',
  setLanguage: (lang) => set({ language: lang }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}))
