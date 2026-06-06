import SeoHead from './SeoHead'
import Head from 'next/head'
import { getToolSeo } from '../utils/toolSeo'

export default function ToolSeoHead({ tool }) {
  const seo = getToolSeo(tool)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pdfchampion.com'
  const toolStructuredData = tool ? {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `PDFChampion ${tool.name}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    url: `${siteUrl}${seo.canonical}`,
    description: seo.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  } : null

  return (
    <>
      <SeoHead
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={seo.canonical}
      />
      {toolStructuredData && (
        <Head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(toolStructuredData) }}
          />
        </Head>
      )}
    </>
  )
}
