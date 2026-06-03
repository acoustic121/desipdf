import Head from 'next/head'

export default function About() {
  return (
    <>
      <Head>
        <title>About – DesiPDF</title>
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6">About DesiPDF</h1>
        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-600 dark:text-gray-400 leading-relaxed">
          <p>
            DesiPDF was built with one mission: give every Indian access to powerful PDF tools — for free, without needing to sign up, and in their own language.
          </p>
          <p>
            From students converting documents for college applications to small business owners preparing invoices, PDFs are a daily part of Indian life. Yet most PDF tools online are expensive, slow, or covered in ads and watermarks.
          </p>
          <p>
            DesiPDF changes that. Built on modern serverless infrastructure, all your file processing happens fast, securely, and at zero cost to you. Files are automatically deleted within 2 hours and never shared with third parties.
          </p>
          <p>
            We support 7 Indian languages — English, Hindi, Tamil, Telugu, Bengali, Marathi, and Gujarati — because India's diversity is its strength.
          </p>
          <div className="flex items-center gap-3 text-2xl font-bold text-blue-600 dark:text-blue-400 mt-8">
            <span>Made with ❤️ in India 🇮🇳</span>
          </div>
        </div>
      </div>
    </>
  )
}
