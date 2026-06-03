import Head from 'next/head'

const FAQS = [
  { q: 'Is PDFChampion free?', a: 'Yes, PDFChampion has a generous Free tier. You can convert up to 15 files per day for free, with files up to 50 MB. For unlimited conversions, larger file sizes (up to 4 GB), priority processing, and an ad-free experience, you can upgrade to Premium.' },
  { q: 'Do I need to create an account?', a: 'No account is required to use the Free plan. You can start converting files right away. However, to upgrade to Premium and enjoy unlimited usage, you will need to sign up for an account.' },
  { q: 'What is the maximum file size?', a: 'For Free tier users, the maximum file size is 50 MB. For Premium users, the limit is increased to 4 GB. All files are processed locally in your web browser, ensuring complete privacy.' },
  { q: 'How many files can I convert?', a: 'Free users can convert up to 15 files per day. If you need more, you can upgrade to the Premium plan which offers unlimited daily conversions.' },
  { q: 'How much does PDFChampion Premium cost?', a: 'To keep it affordable worldwide, we offer regional pricing: in India, it is ₹49/month or ₹499/year. For the US, UK, and Europe, it is $1.00, £1.00, or €1.00 per month (and $9.00, £9.00, or €9.00 per year). For Canada and Australia, it is C$1.49 / A$1.49 per month ($14.99 per year). Other regions are dynamically converted using real-time exchange rates.' },
  { q: 'What payment methods are supported?', a: 'We support Razorpay for local payments in India (including UPI, Net Banking, and cards) and international card payments. For users in other countries, we support international credit/debit cards and PayPal.' },
  { q: 'Will there be watermarks on my files?', a: 'Never. Both Free and Premium users get 100% clean files with no watermarks.' },
  { q: 'How long are my files stored?', a: 'We never store your files. They are processed entirely in your web browser and never uploaded to our servers.' },
  { q: 'Are my files private?', a: 'Yes, 100% private. Because processing runs entirely in your local browser, your sensitive data never leaves your device.' },
  { q: 'Does it work on mobile?', a: 'Yes, PDFChampion is fully responsive and works perfectly on Android and iPhone browsers.' },
  { q: 'Which languages are supported?', a: 'We support 29 languages, including English, Hindi, Spanish, French, German, Japanese, Chinese, and many more, making it easy to use globally.' },
  { q: 'Can I use PDFChampion for commercial purposes?', a: 'Yes, both Free and Premium tiers can be used for commercial and business needs.' },
]

export default function FAQ() {
  return (
    <>
      <Head>
        <title>FAQ – PDFChampion</title>
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">FAQ</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-10">Answers to the most common questions about PDFChampion.</p>
        <div className="space-y-4">
          {FAQS.map((item, i) => (
            <details key={i} className="card p-5 group">
              <summary className="flex items-center justify-between cursor-pointer font-medium text-gray-800 dark:text-gray-200 list-none">
                {item.q}
                <span className="ml-4 text-blue-500 text-xl group-open:rotate-45 transition-transform duration-200 flex-shrink-0">+</span>
              </summary>
              <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  )
}
