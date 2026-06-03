import Head from 'next/head'

const FAQS = [
  { q: 'Is DesiPDF free?', a: 'Yes, all tools are 100% free. No hidden costs, ever.' },
  { q: 'Do I need to create an account?', a: 'No account required. Just upload and convert.' },
  { q: 'What is the maximum file size?', a: 'You can upload files up to 50MB.' },
  { q: 'How long are my files stored?', a: 'Files are automatically deleted within 2 hours of upload.' },
  { q: 'Are my files private?', a: 'Yes. We do not read, sell, or share your files. They are processed and then deleted.' },
  { q: 'Does it work on mobile?', a: 'Fully responsive. Works on Android and iPhone browsers.' },
  { q: 'Which languages are supported?', a: 'English, Hindi, Tamil, Telugu, Bengali, Marathi, and Gujarati.' },
  { q: 'Will there be watermarks on my files?', a: 'Never. Your output files are 100% clean.' },
  { q: 'How many files can I convert?', a: 'There is no limit. Convert as many files as you need.' },
  { q: 'Can I use DesiPDF for commercial purposes?', a: 'Yes, feel free to use it for business needs.' },
]

export default function FAQ() {
  return (
    <>
      <Head>
        <title>FAQ – DesiPDF</title>
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">FAQ</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-10">Answers to the most common questions about DesiPDF.</p>
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
