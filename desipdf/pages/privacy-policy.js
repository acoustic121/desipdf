import Head from 'next/head'

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy – DesiPDF</title>
      </Head>
      <div className="max-w-3xl mx-auto px-4 py-20 text-gray-600 dark:text-gray-400 space-y-6 leading-relaxed">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
        <p>Last updated: June 2024</p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">File Handling</h2>
        <p>Uploaded files are stored temporarily on our servers solely for the purpose of processing your request. All files are automatically deleted within 2 hours of upload, regardless of whether the conversion is completed.</p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Data Collection</h2>
        <p>We do not collect personal information. We do not require registration. We may collect anonymous usage statistics (e.g., number of conversions per tool) to improve the service.</p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Cookies</h2>
        <p>We use minimal cookies to remember your language and theme preferences. No tracking cookies are used.</p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Third Parties</h2>
        <p>We do not sell or share your data or files with any third parties.</p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Contact</h2>
        <p>For any privacy concerns, contact us at privacy@desipdf.com.</p>
      </div>
    </>
  )
}
