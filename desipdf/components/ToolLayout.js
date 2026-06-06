import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { SEO_GUIDES } from '../utils/seoGuides'

export default function ToolLayout({ tool, children }) {
  const guide = SEO_GUIDES[tool.id] || {
    steps: [
      `Select your file by clicking the upload box or dragging it in.`,
      `The conversion processes securely. Browser-first tools run locally; serverless tools handle only the requested conversion.`,
      `Click the download button to save the converted file to your device.`
    ],
    benefits: [
      { title: 'Privacy Safeguard', desc: 'Browser-first tools keep files on your device. Server-assisted tools use temporary processing only.' },
      { title: 'Fast Processing', desc: 'Tools are optimized to finish quickly whether they run locally or through a secure conversion endpoint.' },
      { title: 'Unlimited Free Use', desc: 'Convert as much as you need with no daily caps, no signup requirement, and no watermarks.' }
    ],
    faqs: [
      { q: 'Are my files sent to any servers?', a: 'Many PDFChampion tools run locally in your browser. If a tool uses serverless conversion, your file is processed only for that request and cleaned up automatically.' },
      { q: 'Does this tool work on mobile devices?', a: 'Yes. PDFChampion is fully responsive and optimized for Chrome, Safari, and other mobile browsers.' }
    ]
  }

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
          <span>🔒 Privacy-first processing</span>
          <span>🆓 Unlimited free use</span>
          <span>⚡ Fast processing</span>
          <span>📱 Works on mobile</span>
        </div>

        {/* Divider */}
        <hr className="my-12 border-gray-200 dark:border-gray-800" />

        {/* SEO Guide Section */}
        <div className="space-y-10">
          {/* How to use */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>📖</span> How to use {tool.name}
            </h2>
            <ol className="space-y-3">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="leading-6">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Benefits */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>🌟</span> Benefits of {tool.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {guide.benefits.map((benefit, index) => (
                <div key={index} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800/80 bg-white/50 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{benefit.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tool specific FAQ */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>❓</span> {tool.name} FAQs
            </h2>
            <div className="space-y-3">
              {guide.faqs.map((faq, index) => (
                <details key={index} className="group border border-gray-100 dark:border-gray-800/80 rounded-xl bg-white/50 dark:bg-gray-900/50 p-4">
                  <summary className="flex items-center justify-between cursor-pointer font-medium text-sm text-gray-800 dark:text-gray-200 list-none">
                    {faq.q}
                    <span className="text-blue-500 text-lg group-open:rotate-45 transition-transform duration-200 flex-shrink-0 ml-2">+</span>
                  </summary>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
