import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Instagram Reels Downloader',
  icon: '🎞️',
  color: 'from-fuchsia-500 to-purple-600',
  description: 'Download Instagram Reels as MP4 videos without watermark. Save any public reel to your device instantly.',
  platformLabel: 'Instagram Reels',
  placeholder: 'https://www.instagram.com/reel/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Instagram Reels Downloader – Save Reels as MP4 | PDFChampion" description="Download Instagram Reels as MP4. No watermark, free and instant." canonical="/tools/video/instagram-reels-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
