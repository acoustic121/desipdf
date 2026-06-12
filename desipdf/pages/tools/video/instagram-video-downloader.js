import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Instagram Video Downloader',
  icon: '📹',
  color: 'from-pink-500 to-fuchsia-600',
  description: 'Download Instagram videos in HD quality. Paste any public Instagram video URL and save it instantly.',
  platformLabel: 'Instagram',
  placeholder: 'https://www.instagram.com/p/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Instagram Video Downloader – Download HD Videos Free | PDFChampion" description="Download Instagram videos in HD quality for free. No signup, instant download." canonical="/tools/video/instagram-video-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
