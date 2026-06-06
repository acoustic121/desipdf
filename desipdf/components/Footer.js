import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 font-bold text-xl mb-3">
              <span>📄</span>
              <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">PDFChampion</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Free online PDF tools. No signup required for daily use, no watermarks, and privacy-first processing.
            </p>
          </div>

          {/* Tools */}
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Popular Tools</h3>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><Link href="/tools/pdf-to-jpg" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">PDF to JPG</Link></li>
              <li><Link href="/tools/merge-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Merge PDF</Link></li>
              <li><Link href="/tools/compress-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Compress PDF</Link></li>
              <li><Link href="/tools/word-to-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Word to PDF</Link></li>
              <li><Link href="/tools/split-pdf" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Split PDF</Link></li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Company</h3>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><Link href="/pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</Link></li>
              <li><Link href="/about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link href="/faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Log In</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} PDFChampion. All rights reserved.</p>
          <p>Made with ❤️ in India 🇮🇳</p>
        </div>
      </div>
    </footer>
  )
}
