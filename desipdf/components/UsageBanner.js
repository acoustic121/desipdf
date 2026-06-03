import { useState, useEffect } from 'react'
import { getRemainingUses, FREE_LIMIT_PER_DAY } from '../utils/usageLimit'
import LimitModal from './LimitModal'

export default function UsageBanner() {
  const [remaining, setRemaining] = useState(FREE_LIMIT_PER_DAY)
  const [showModal, setShowModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setRemaining(getRemainingUses())

    // Listen for usage changes dispatched by tool pages
    const handler = () => setRemaining(getRemainingUses())
    window.addEventListener('desipdf-usage-updated', handler)
    return () => window.removeEventListener('desipdf-usage-updated', handler)
  }, [])

  if (!mounted) return null

  const used = FREE_LIMIT_PER_DAY - remaining
  const pct = (used / FREE_LIMIT_PER_DAY) * 100

  if (remaining === FREE_LIMIT_PER_DAY) return null // Don't show until at least 1 use

  return (
    <>
      {showModal && <LimitModal onClose={() => setShowModal(false)} />}

      <div className={`fixed bottom-4 right-4 z-40 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border ${remaining === 0 ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-gray-800'} p-4 max-w-xs w-full`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {remaining === 0 ? '🚫 Free limit reached' : `⚡ ${remaining} free use${remaining !== 1 ? 's' : ''} left today`}
          </span>
          <span className="text-xs text-gray-400">{used}/{FREE_LIMIT_PER_DAY}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-3">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${remaining === 0 ? 'bg-red-500' : remaining <= 1 ? 'bg-orange-400' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {remaining === 0 ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Upgrade to Premium →
          </button>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
            Resets at midnight · <button onClick={() => setShowModal(true)} className="text-blue-500 hover:underline">Go unlimited</button>
          </p>
        )}
      </div>
    </>
  )
}
