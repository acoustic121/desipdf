import '../styles/globals.css'
import { AuthProvider } from '../utils/useAuth'
import { I18nProvider } from '../utils/i18n'
import Layout from '../components/Layout'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <I18nProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </I18nProvider>
    </AuthProvider>
  )
}
