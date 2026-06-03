import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function ToolLayout({ tool, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 dark:from-gray-900/50 to-transparent py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-8 transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
          All Tools
        </Link>

        {/* Tool Header */}
        <div className="mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.color} text-3xl shadow-md mb-4`}>
            {tool.icon}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{tool.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{tool.description}</p>
        </div>

        {/* Content */}
        <div className="card p-6 md:p-8">
          {children}
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-600">
          <span>🔒 Files deleted after 2 hours</span>
          <span>🆓 100% Free</span>
          <span>⚡ Fast processing</span>
          <span>📱 Works on mobile</span>
        </div>
      </div>
    </div>
  )
}
