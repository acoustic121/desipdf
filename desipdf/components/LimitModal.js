import Link from 'next/link'
import { FREE_LIMIT_PER_DAY } from '../utils/usageLimit'
import { useAuth } from '../utils/useAuth'

export default function LimitModal({ onClose }) {
  const { user } = useAuth()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">⚡</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {user ? 'Daily Limit Reached' : 'Free Limit Reached'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          {user
            ? `You've used all ${FREE_LIMIT_PER_DAY} free conversions for today. Upgrade to Premium for unlimited access.`
            : `You've used all ${FREE_LIMIT_PER_DAY} free conversions. Create a free account or upgrade to Premium.`
          }
        </p>

        {/* Premium features */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl p-5 mb-6 text-left space-y-2.5">
          {[
            { icon: '♾️', text: 'Unlimited conversions per day' },
            { icon: '📦', text: 'Files up to 4 GB (vs 50 MB free)' },
            { icon: '⚡', text: 'Unlimited files per merge/batch' },
            { icon: '🤖', text: 'AI Summarizer & Translate (coming soon)' },
            { icon: '🚫', text: 'Ad-free experience' },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-lg">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Pricing teaser */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            ₹49<span className="text-base font-normal text-gray-400">/month</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">or ₹499/year (save 18%) · Cancel anytime</p>
        </div>

        {/* CTAs */}
        {user ? (
          <>
            <Link
              href="/pricing"
              onClick={onClose}
              className="block w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-base hover:opacity-90 transition-opacity shadow-lg mb-3"
            >
              Upgrade to Premium →
            </Link>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              Come back tomorrow (resets at midnight)
            </button>
          </>
        ) : (
          <>
            <Link
              href="/signup"
              onClick={onClose}
              className="block w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-base hover:opacity-90 transition-opacity shadow-lg mb-3"
            >
              Create Free Account →
            </Link>
            <Link
              href="/pricing"
              onClick={onClose}
              className="block w-full py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-all mb-3"
            >
              View Premium Plans
            </Link>
            <button onClick={onClose} className="w-full text-xs text-gray-300 dark:text-gray-600 hover:text-gray-500 transition-colors">
              Come back tomorrow (resets at midnight)
            </button>
          </>
        )}
      </div>
    </div>
  )
}
