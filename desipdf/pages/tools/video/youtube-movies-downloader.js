import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube Movies Downloader',
  icon: '🎥',
  color: 'from-slate-600 to-gray-800',
  description: 'Download free movies and video content from YouTube. Save full videos in your preferred quality.',
  platformLabel: 'YouTube',
  placeholder: 'https://www.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube Movies Downloader – Free Video Download | PDFChampion" description="Download YouTube movies and videos for free. Multiple quality options." canonical="/tools/video/youtube-movies-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
