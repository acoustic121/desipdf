import Link from 'next/link'

export default function LimitModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">♾️</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Unlimited Free Conversions
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          PDFChampion is currently free forever: no daily conversion cap, no signup required, no watermarks, and privacy-first processing.
        </p>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl p-5 mb-6 text-left space-y-2.5">
          {[
            { icon: '♾️', text: 'Unlimited daily conversions' },
            { icon: '📦', text: 'No artificial file-size limit' },
            { icon: '⚡', text: 'Unlimited files per merge or batch' },
            { icon: '🚫', text: 'No watermarks' },
            { icon: '🔒', text: 'Browser-first and serverless processing' },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-lg">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="block w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-base hover:opacity-90 transition-opacity shadow-lg mb-3">
          Keep Converting Free
        </button>
        <Link href="/pricing" onClick={onClose} className="block w-full py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-all">
          View Future Premium Options
        </Link>
      </div>
    </div>
  )
}
