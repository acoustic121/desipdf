import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube Shorts Downloader',
  icon: '⚡',
  color: 'from-red-400 to-orange-500',
  description: 'Download YouTube Shorts videos instantly. Save any YouTube Short as MP4 to your device without a watermark.',
  platformLabel: 'YouTube Shorts',
  placeholder: 'https://www.youtube.com/shorts/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube Shorts Downloader – Save Shorts as MP4 | PDFChampion" description="Download YouTube Shorts as MP4 for free. No watermark, no signup required." canonical="/tools/video/youtube-shorts-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
