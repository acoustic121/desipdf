import Link from 'next/link'

export default function ComingSoon({ tool }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/60 dark:from-gray-900/50 to-transparent py-10 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 mb-10 transition-colors">
          ← All Tools
        </Link>

        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br ${tool.color} text-4xl shadow-lg mb-6`}>
          {tool.icon}
        </div>

        <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
          ✨ Coming Soon
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">{tool.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-10 max-w-md mx-auto leading-relaxed">
          {tool.description}
        </p>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 mb-8">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Get notified when it launches</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">We&apos;re building this tool. Leave your email to be the first to know.</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="you@example.com"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              onClick={() => alert('Thank you! We will notify you when this launches.')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Notify Me
            </button>
          </div>
        </div>

        <Link href="/" className="btn-primary justify-center">
          ← Browse Live Tools
        </Link>
      </div>
    </div>
  )
}
