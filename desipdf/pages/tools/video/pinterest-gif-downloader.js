import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Pinterest GIF Downloader',
  icon: '🎭',
  color: 'from-rose-500 to-pink-600',
  description: 'Download animated GIFs from Pinterest in full quality. Save any Pinterest GIF pin directly to your device.',
  platformLabel: 'Pinterest',
  placeholder: 'https://www.pinterest.com/pin/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Pinterest GIF Downloader – Save Animated GIFs | PDFChampion" description="Download Pinterest GIFs in full quality. Free, fast, no signup." canonical="/tools/video/pinterest-gif-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
