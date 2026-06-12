import Head from 'next/head'

/**
 * SeoHead – drop this into every page to get full SEO coverage.
 *
 * Props:
 *   title       – page title (shown in browser tab + Google blue link)
 *   description – meta description (shown in Google snippet under the title)
 *   keywords    – comma-separated keywords string
 *   canonical   – canonical URL of the page (e.g. https://pdfchampion.com/tools/merge-pdf)
 *   ogImage     – absolute URL of the Open Graph image (defaults to /og-image.png)
 */
export default function SeoHead({
  title,
  description,
  keywords = '',
  canonical,
  ogImage = 'https://pdfchampion.com/og-image.png',
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pdfchampion.com'
  const fullTitle = title || 'PDFChampion - Free PDF Tools'
  const fullCanonical = canonical ? `${siteUrl}${canonical}` : siteUrl
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: 'PDFChampion',
        alternateName: 'PDF Champion',
        url: siteUrl,
      },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: 'PDFChampion',
        url: siteUrl,
        logo: `${siteUrl}/icon-192x192.png`,
      },
    ],
  }

  return (
    <Head>
      {/* ── Basic SEO ─────────────────────────────────────────────────── */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={fullCanonical} />
      <meta name="robots" content="index, follow" />
      <meta name="author" content="PDFChampion" />

      {/* ── Open Graph (Facebook / WhatsApp preview) ──────────────────── */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="PDFChampion" />
      <meta property="og:locale" content="en_IN" />

      {/* ── Twitter Card ──────────────────────────────────────────────── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </Head>
  )
}
