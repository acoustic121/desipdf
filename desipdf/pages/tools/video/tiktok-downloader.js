import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'TikTok Downloader',
  icon: '🎵',
  color: 'from-slate-800 to-gray-900',
  description: 'Download TikTok videos without watermark in HD quality. Save TikTok videos and audio tracks for free.',
  platformLabel: 'TikTok',
  placeholder: 'https://www.tiktok.com/@user/video/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="TikTok Downloader – Download Without Watermark Free | PDFChampion" description="Download TikTok videos without watermark. HD quality, free, no signup required." canonical="/tools/video/tiktok-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
