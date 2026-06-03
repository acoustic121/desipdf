import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Script from 'next/script'
import '../styles/globals.css'
import { AuthProvider } from '../utils/useAuth'
import { I18nProvider } from '../utils/i18n'
import Layout from '../components/Layout'
import { Analytics } from '@vercel/analytics/react'
import { GA_MEASUREMENT_ID, pageview } from '../utils/analytics'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return

    const handleRouteChange = (url) => {
      pageview(url)
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  return (
    <AuthProvider>
      <I18nProvider>
        <Layout>
          {GA_MEASUREMENT_ID && (
            <>
              <Script
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              />
              <Script
                id="gtag-init"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', {
                      page_path: window.location.pathname,
                    });
                  `,
                }}
              />
            </>
          )}
          <Component {...pageProps} />
          <Analytics />
        </Layout>
      </I18nProvider>
    </AuthProvider>
  )
}

