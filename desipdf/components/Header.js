import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SunIcon, MoonIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES } from '../utils/constants'
import { useI18n } from '../utils/i18n'
import { useAuth } from '../utils/useAuth'

// ─── Tools Dropdown Data ───────────────────────────────────────────────────
const organizeTools = [
  { name: 'Merge PDF', href: '/tools/merge-pdf', icon: '🔗' },
  { name: 'Split PDF', href: '/tools/split-pdf', icon: '✂️' },
  { name: 'Reorder Pages', href: '/tools/reorder-pages', icon: '↕️' },
  { name: 'Extract Pages', href: '/tools/extract-pages', icon: '📋' },
  { name: 'Scan to PDF', href: '/tools/scan-to-pdf', icon: '📷' },
]
const optimizeTools = [
  { name: 'Compress PDF', href: '/tools/compress-pdf', icon: '🗜️' },
  { name: 'Repair PDF', href: '/tools/repair-pdf', icon: '🔧' },
  { name: 'OCR PDF', href: '/tools/ocr-pdf', icon: '🔍' },
]
const convertToPdfTools = [
  { name: 'JPG to PDF', href: '/tools/jpg-to-pdf', icon: '📄' },
  { name: 'Word to PDF', href: '/tools/word-to-pdf', icon: '📝' },
  { name: 'PPT to PDF', href: '/tools/pptx-to-pdf', icon: '📑' },
  { name: 'Excel to PDF', href: '/tools/excel-to-pdf', icon: '📊' },
  { name: 'HTML to PDF', href: '/tools/html-to-pdf', icon: '🌐' },
]
const convertFromPdfTools = [
  { name: 'PDF to JPG', href: '/tools/pdf-to-jpg', icon: '🖼️' },
  { name: 'PDF to Word', href: '/tools/pdf-to-word', icon: '✏️' },
  { name: 'PDF to PPT', href: '/tools/pdf-to-pptx', icon: '🎞️' },
  { name: 'PDF to Excel', href: '/tools/pdf-to-excel', icon: '📈' },
  { name: 'Bank Statement Converter', href: '/tools/bank-statement-converter', icon: '🏦' },
]
const editTools = [
  { name: 'Rotate PDF', href: '/tools/rotate-pdf', icon: '🔄' },
  { name: 'Page Numbers', href: '/tools/page-numbers', icon: '🔢' },
  { name: 'Watermark PDF', href: '/tools/pdf-watermark', icon: '💧' },
  { name: 'Crop PDF', href: '/tools/crop-pdf', icon: '✂️' },
  { name: 'Redact PDF', href: '/tools/redact-pdf', icon: '🖤' },
  { name: 'Edit PDF', href: '/tools/edit-pdf', icon: '🖊️' },
]
const secureTools = [
  { name: 'Protect PDF', href: '/tools/protect-pdf', icon: '🔒' },
  { name: 'Unlock PDF', href: '/tools/unlock-pdf', icon: '🔓' },
  { name: 'Sign PDF', href: '/tools/sign-pdf', icon: '✍️' },
  { name: 'Compare PDF', href: '/tools/compare-pdf', icon: '⚖️' },
]
const aiTools = [
  { name: 'AI Summarizer', href: '/tools/ai-summarizer', icon: '🤖' },
  { name: 'Translate PDF', href: '/tools/translate-pdf', icon: '🌏' },
]

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
      <div className="max-w-7xl mx-auto pl-1 sm:pl-2 lg:pl-3 pr-4 sm:pr-6 lg:pr-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">📄</span>
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
              {t('site.name')}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-xs lg:text-sm font-bold text-slate-700 dark:text-slate-200">
            <Link href="/tools/merge-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase">Merge PDF</Link>
            <Link href="/tools/compress-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase">Compress PDF</Link>
            <Link
              href="/tools/bank-statement-converter"
              className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase whitespace-nowrap"
            >
              <span className="text-sm">🏦</span> Bank Statement
            </Link>

            {/* Convert PDF */}
            <div className="relative group py-5">
              <button className="flex items-center gap-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase">
                Convert PDF
                <svg className="w-3 h-3 transition-transform duration-200 group-hover:rotate-180 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              <div className="absolute left-0 top-full w-[420px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl p-5 grid grid-cols-2 gap-6 z-50 transition-all duration-200 ease-in-out opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0">
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Convert to PDF</h3>
                  <div className="space-y-1">
                    {convertToPdfTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Convert from PDF</h3>
                  <div className="space-y-1">
                    {convertFromPdfTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* All PDF Tools */}
            <div className="relative group py-5">
              <button className="flex items-center gap-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase">
                All PDF Tools
                <svg className="w-3 h-3 transition-transform duration-200 group-hover:rotate-180 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              <div className="absolute left-1/2 -translate-x-[45%] top-full w-[95vw] max-w-6xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl p-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-5 lg:gap-6 z-50 transition-all duration-200 ease-in-out opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0">
                
                {/* Organize */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Organize PDF</h3>
                  <div className="space-y-1">
                    {organizeTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Optimize */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Optimize PDF</h3>
                  <div className="space-y-1">
                    {optimizeTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Convert to */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Convert to PDF</h3>
                  <div className="space-y-1">
                    {convertToPdfTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Convert from */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Convert from PDF</h3>
                  <div className="space-y-1">
                    {convertFromPdfTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Edit */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Edit PDF</h3>
                  <div className="space-y-1">
                    {editTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Security */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">PDF Security</h3>
                  <div className="space-y-1">
                    {secureTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Intelligence */}
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">PDF Intelligence</h3>
                  <div className="space-y-1">
                    {aiTools.map(t => (
                      <Link key={t.href} href={t.href} className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg hover:text-blue-600 transition-all">
                        <span>{t.icon}</span> {t.name}
                      </Link>
                    ))}
                  </div>
                </div>

              </div>
            </div>
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

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Popular Tools</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/tools/merge-pdf" className="block p-2 text-xs font-semibold rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:text-blue-600" onClick={() => setMenuOpen(false)}>🔗 Merge PDF</Link>
                <Link href="/tools/split-pdf" className="block p-2 text-xs font-semibold rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:text-blue-600" onClick={() => setMenuOpen(false)}>✂️ Split PDF</Link>
                <Link href="/tools/compress-pdf" className="block p-2 text-xs font-semibold rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:text-blue-600" onClick={() => setMenuOpen(false)}>🗜️ Compress PDF</Link>
                <Link href="/tools/sign-pdf" className="block p-2 text-xs font-semibold rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:text-blue-600" onClick={() => setMenuOpen(false)}>✍️ Sign PDF</Link>
                <Link href="/tools/bank-statement-converter" className="block p-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:text-blue-600 col-span-2" onClick={() => setMenuOpen(false)}>🏦 Bank Statement Converter</Link>
              </div>
            </div>

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
