import Head from 'next/head'
import ComingSoon from '../../components/ComingSoon'
import { TOOLS } from '../../utils/constants'
const tool = TOOLS.find((t) => t.id === 'ai-summarizer')
export default function Page() {
  return (
    <>
      <Head><title>{tool?.name} – DesiPDF</title></Head>
      <ComingSoon tool={tool} />
    </>
  )
}
