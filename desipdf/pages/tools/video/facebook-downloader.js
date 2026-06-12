import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Facebook Video Downloader',
  icon: '👥',
  color: 'from-blue-600 to-indigo-700',
  description: 'Download public Facebook videos in HD or SD quality. Paste any public Facebook video link and save it instantly.',
  platformLabel: 'Facebook',
  placeholder: 'https://www.facebook.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Facebook Video Downloader – Free HD Download | PDFChampion" description="Download Facebook videos in HD or SD. Free, fast, no login needed." canonical="/tools/video/facebook-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
