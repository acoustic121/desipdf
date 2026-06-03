import Link from 'next/link'
import { useI18n } from '../utils/i18n'

export default function ToolCard({ tool }) {
  const { t } = useI18n()
  const translatedName = t(`tools.${tool.id}`)
  // Fall back to the hardcoded name if translation key not found
  const displayName = translatedName === `tools.${tool.id}` ? tool.name : translatedName

  return (
    <Link href={`/tools/${tool.id}`}>
      <div className="card p-5 cursor-pointer group hover:scale-[1.02] transition-transform duration-200">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} text-2xl mb-4 shadow-sm`}>
          {tool.icon}
        </div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {displayName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          {tool.description}
        </p>
      </div>
    </Link>
  )
}
