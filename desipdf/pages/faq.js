import Head from 'next/head'

const FAQS = [
  { q: 'Is PDFChampion free?', a: 'Yes. PDFChampion is free forever with unlimited daily conversions, no signup requirement, no watermarks, and no hidden caps.' },
  { q: 'Do I need to create an account?', a: 'No account is required. Anyone can start using the tools immediately. If users want an account, they can sign up with Google or email.' },
  { q: 'What is the maximum file size?', a: 'There is no artificial file-size limit. Browser-only tools are limited mainly by your device memory, and serverless tools are limited only by platform processing capacity.' },
  { q: 'How many files can I convert?', a: 'As many as you want. PDFChampion does not enforce a daily conversion limit for logged-in users, subscribed users, or anonymous visitors.' },
  { q: 'Why is there still a pricing page?', a: 'Premium and subscription infrastructure is available for future functionality, but the current PDF tools are free and unlimited for everyone.' },
  { q: 'What payment methods are supported?', a: 'Razorpay payment support is already integrated for future premium features. You do not need to pay to use the current PDF tools.' },
  { q: 'Will there be watermarks on my files?', a: 'Never. Your output files stay clean with no PDFChampion branding or watermark.' },
  { q: 'How long are my files stored?', a: 'Browser-only tools keep files on your device. Serverless tools use temporary processing for the requested conversion and clean up files automatically.' },
  { q: 'Are my files private?', a: 'Yes. PDFChampion is privacy-first: many tools run locally in your browser, and serverless tools process files only for the conversion you request.' },
  { q: 'Does it work on mobile?', a: 'Yes, PDFChampion is fully responsive and works perfectly on Android and iPhone browsers.' },
  { q: 'Which languages are supported?', a: 'We support 29 languages, including English, Hindi, Spanish, French, German, Japanese, Chinese, and many more, making it easy to use globally.' },
  { q: 'Can I use PDFChampion for commercial purposes?', a: 'Yes. You can use PDFChampion for personal, professional, and business documents.' },
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
