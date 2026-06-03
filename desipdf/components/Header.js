import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SunIcon, MoonIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES } from '../utils/constants'
import { useI18n } from '../utils/i18n'
import { useAuth } from '../utils/useAuth'

export default function Header() {
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { lang, setLang, t } = useI18n()
  const { user, isPremium, premiumDaysRemaining, signOut } = useAuth()
  const router = useRouter()
  const userMenuRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light'
    setDark(saved === 'dark')
    document.documentElement.classList.toggle('dark', saved === 'dark')
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  const handleLang = (code) => {
    setLang(code)
    setMenuOpen(false)
  }

  const handleSignOut = async () => {
    await signOut()
    setUserMenuOpen(false)
    router.push('/')
  }

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?'

  return (
    <>
      {isPremium && premiumDaysRemaining !== null && premiumDaysRemaining <= 3 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-center py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 select-none">
          <span>
            ⚠️ Your Premium subscription expires {premiumDaysRemaining === 0 ? 'today' : premiumDaysRemaining === 1 ? 'tomorrow' : `in ${premiumDaysRemaining} days`}.
          </span>
          <Link href="/pricing" className="underline hover:text-amber-100 font-bold transition-colors">
            Renew now
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">📄</span>
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
              {t('site.name')}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('nav.home')}</Link>
            <Link href="/pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('nav.about')}</Link>
            <Link href="/faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t('nav.faq')}</Link>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <select
              value={lang}
              onChange={(e) => handleLang(e.target.value)}
              className="hidden sm:block text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[130px]"
            >
              <optgroup label="🇮🇳 Indian">
                {INDIAN_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.native}</option>
                ))}
              </optgroup>
              <optgroup label="🌍 International">
                {INTERNATIONAL_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.native}</option>
                ))}
              </optgroup>
            </select>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {dark
                ? <SunIcon className="h-5 w-5 text-yellow-400" />
                : <MoonIcon className="h-5 w-5 text-gray-600" />
              }
            </button>

            {/* Auth Buttons / User Menu */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {initials}
                  </div>
                  {isPremium && (
                    <span className="text-xs font-bold text-amber-500">⭐</span>
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {user.user_metadata?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      {isPremium && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 mt-1">
                          ⭐ Premium Member
                        </span>
                      )}
                    </div>
                    {!isPremium && (
                      <Link
                        href="/pricing"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-semibold"
                      >
                        ⚡ Upgrade to Premium
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1.5 transition-colors">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary text-sm px-4 py-1.5">
                  Sign up free
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800"
            >
              {menuOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <Link href="/" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>{t('nav.home')}</Link>
            <Link href="/pricing" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <Link href="/about" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>{t('nav.about')}</Link>
            <Link href="/faq" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>{t('nav.faq')}</Link>
            {!user && (
              <div className="flex gap-2 pt-2">
                <Link href="/login" className="flex-1 text-center py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>Log in</Link>
                <Link href="/signup" className="flex-1 text-center py-2 bg-blue-600 text-white rounded-xl text-sm font-medium" onClick={() => setMenuOpen(false)}>Sign up</Link>
              </div>
            )}
            <select
              value={lang}
              onChange={(e) => handleLang(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-full"
            >
              <optgroup label="🇮🇳 Indian"><option value="en">English</option>{INDIAN_LANGUAGES.slice(1).map(l => <option key={l.code} value={l.code}>{l.native}</option>)}</optgroup>
              <optgroup label="🌍 International">{INTERNATIONAL_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}</optgroup>
            </select>
          </div>
        )}
      </div>
    </header>
    </>
  )
}
