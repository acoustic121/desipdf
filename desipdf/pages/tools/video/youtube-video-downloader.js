import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube Video Downloader',
  icon: '📹',
  color: 'from-red-500 to-rose-600',
  description: 'Download YouTube videos in MP4 format with multiple quality options up to 4K. Fast, free, and no registration needed.',
  platformLabel: 'YouTube',
  placeholder: 'https://www.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube Video Downloader – Free MP4 Download | PDFChampion" description="Download YouTube videos in MP4 with quality options up to 4K. Free, fast, no signup." canonical="/tools/video/youtube-video-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
