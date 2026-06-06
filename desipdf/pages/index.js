import SeoHead from '../components/SeoHead'
import Link from 'next/link'
import { useState } from 'react'
import { TOOLS, CATEGORIES, INDIAN_LANGUAGES, INTERNATIONAL_LANGUAGES } from '../utils/constants'
import { useI18n } from '../utils/i18n'


const FAQ_ITEMS = [
  { q: 'Is PDFChampion completely free?', a: 'Yes. PDFChampion is free forever with unlimited daily conversions, no signup requirement, and no watermarks.' },
  { q: 'Are my files safe?', a: 'Yes. Most tools process files directly in your browser. When a tool needs serverless processing, files are used only for that request and cleaned up automatically.' },
  { q: 'What is the maximum file size?', a: 'There is no artificial file-size limit. Browser-only tools are limited mainly by your device memory, and serverless tools are limited only by platform processing capacity.' },
  { q: 'Does it work on mobile?', a: 'Yes! PDFChampion is fully responsive and works on all Android and iPhone browsers.' },
  { q: 'Do I need to install anything?', a: 'No installation needed. Everything runs directly in your browser.' },
  { q: 'Which languages are supported?', a: 'PDFChampion supports 29 languages — including English, Hindi, Spanish, French, German, Japanese, and more.' },
]

function ToolCard({ tool }) {
  const isComingSoon = tool.status === 'coming-soon'

  const card = (
    <div className={`group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 transition-all duration-200 ${isComingSoon ? 'opacity-70 cursor-default' : 'hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 hover:-translate-y-0.5 cursor-pointer'}`}>
      {/* Coming soon badge */}
      {isComingSoon && (
        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-2 py-0.5 rounded-full">
          Soon
        </span>
      )}

      {/* Icon */}
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} text-2xl mb-4 shadow-sm`}>
        {tool.icon}
      </div>

      {/* Text */}
      <h3 className={`font-semibold text-gray-800 dark:text-gray-200 mb-1 ${!isComingSoon && 'group-hover:text-blue-600 dark:group-hover:text-blue-400'} transition-colors`}>
        {tool.name}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        {tool.description}
      </p>
    </div>
  )

  if (isComingSoon) return card
  return <Link href={`/tools/${tool.id}`}>{card}</Link>
}

export default function Home() {
  const { t } = useI18n()
  const [activeCategory, setActiveCategory] = useState('all')
  const [toolSearch, setToolSearch] = useState('')

  const categoryFiltered = activeCategory === 'all'
    ? TOOLS
    : TOOLS.filter((t) => t.category === activeCategory)
  const searchQuery = toolSearch.trim().toLowerCase()
  const filtered = searchQuery
    ? categoryFiltered.filter((tool) => (
      `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(searchQuery)
    ))
    : categoryFiltered

  const liveCounts = CATEGORIES.map((c) => ({
    ...c,
    count: c.id === 'all' ? TOOLS.length : TOOLS.filter((t) => t.category === c.id).length,
  }))

  return (
    <>
      <SeoHead
        title="Free PDF Tools – Convert, Merge, Compress PDFs Online"
        description="PDFChampion is a free online PDF tool. Merge, split, compress, convert, rotate, watermark, and protect PDF files with unlimited daily use, no signup, and no watermarks."
        keywords="pdf tools, merge pdf, compress pdf, pdf to word, word to pdf, jpg to pdf, pdf converter online free"
        canonical="/"
      />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-cyan-400 rounded-full opacity-10 blur-3xl" />
          <div className="absolute top-1/2 right-0 w-80 h-80 bg-indigo-400 rounded-full opacity-10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-300 rounded-full opacity-10 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium">
              ⚡ Free forever · No file limit · No signup required · No watermarks
            </div>
            <div className="inline-flex items-center gap-1.5 bg-orange-500/20 backdrop-blur border border-orange-500/30 rounded-full px-4 py-1.5 text-sm font-semibold text-orange-200">
              🇮🇳 Made in India
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            {t('hero.headline')}<br />
            <span className="bg-gradient-to-r from-cyan-300 to-blue-200 bg-clip-text text-transparent">
              {TOOLS.length} Free PDF Tools
            </span>
          </h1>

          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('hero.sub')}
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#tools" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 shadow-xl transition-all">
              Explore All Tools ↓
            </a>
            <Link href="/tools/merge-pdf" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-all">
              Try Merge PDF →
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 gap-4 max-w-sm mx-auto">
            {[
              { value: `${TOOLS.length}+`, label: 'PDF Tools' },
              { value: `${INDIAN_LANGUAGES.length} Indian`, label: `+ ${INTERNATIONAL_LANGUAGES.length} International` },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-4">
                <div className="text-xl font-bold leading-tight">{s.value}</div>
                <div className="text-xs text-blue-200 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOOLS SECTION ────────────────────────────────────────────────── */}
      <section id="tools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Section header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">All PDF Tools</h2>
          <div className="relative mx-auto mt-6 max-w-2xl">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-400">⌕</span>
            <input
              type="search"
              value={toolSearch}
              onChange={(event) => setToolSearch(event.target.value)}
              placeholder="Search tools, e.g. merge, compress, bank statement..."
              className="w-full rounded-2xl border-2 border-gray-200 bg-white py-4 pl-12 pr-12 text-base font-medium text-gray-900 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-950"
            />
            {toolSearch && (
              <button
                type="button"
                onClick={() => setToolSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-2 text-2xl font-bold text-gray-400 hover:text-blue-600"
                aria-label="Clear tool search"
              >
                ×
              </button>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Pick a category or browse everything
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {liveCounts.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-200 ${
                activeCategory === cat.id
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-gray-900'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${activeCategory === cat.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tool Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
        {!filtered.length && (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            No tools found for “{toolSearch}”.
          </div>
        )}
      </section>

      {/* ── WHY PDFCHAMPION ──────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-900/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Why Choose PDFChampion?</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Built for speed, simplicity, and privacy</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '🆓', title: 'Free Forever', desc: 'Unlimited daily conversions, no signup requirement, no watermarks, and no hidden caps.' },
              { icon: '🔒', title: 'Private & Secure', desc: 'Most tools run locally in your browser. Serverless tools process files only for the requested conversion.' },
              { icon: '⚡', title: 'Fast Processing', desc: 'Browser-first tools avoid upload delays, and serverless tools are optimized for quick downloads.' },
              { icon: '📱', title: 'Works on Any Device', desc: 'Phone, tablet, laptop — PDFChampion works perfectly on every screen and browser.' },
              { icon: '🌍', title: 'Supports 29 Languages', desc: 'Use PDFChampion in English, Spanish, French, German, Japanese, Hindi, Tamil, Telugu, and more.' },
              { icon: '🚫', title: 'Zero Watermarks', desc: 'Your output files are clean. No stamps, no logos, no "made with" text — ever.' },
            ].map((f) => (
              <div key={f.title} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 group">
              <summary className="flex items-center justify-between cursor-pointer font-medium text-gray-800 dark:text-gray-200 list-none">
                {item.q}
                <span className="ml-4 text-blue-500 text-xl transition-transform duration-200 group-open:rotate-45 flex-shrink-0">+</span>
              </summary>
              <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-cyan-500 to-blue-600 py-16 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Start Converting for Free</h2>
          <p className="text-blue-100 mb-8">Unlimited conversions. No signup required. No watermarks. No credit card needed.</p>
          <a href="#tools" className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-8 py-3.5 rounded-xl hover:bg-blue-50 shadow-lg transition-all">
            Browse All Tools ↑
          </a>
        </div>
      </section>
    </>
  )
}
