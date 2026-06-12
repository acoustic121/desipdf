import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube to MP4',
  icon: '💾',
  color: 'from-red-500 to-rose-600',
  description: 'Download YouTube videos directly as MP4 files. Choose from multiple resolutions including 720p, 1080p, and 4K.',
  platformLabel: 'YouTube',
  placeholder: 'https://www.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube to MP4 Downloader – Free HD Download | PDFChampion" description="Download YouTube videos as MP4. Choose 720p, 1080p or higher quality. Free and fast." canonical="/tools/video/youtube-to-mp4" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
