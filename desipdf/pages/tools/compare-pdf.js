import Head from 'next/head'
import ComingSoon from '../../components/ComingSoon'
import { TOOLS } from '../../utils/constants'
const tool = TOOLS.find((t) => t.id === 'compare-pdf')
export default function Page() {
  return (
    <>
      <Head><title>{tool?.name} – PDFChampion</title></Head>
      <ComingSoon tool={tool} />
    </>
  )
}
