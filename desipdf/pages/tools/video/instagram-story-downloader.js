import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Instagram Story Downloader',
  icon: '⭕',
  color: 'from-orange-500 to-amber-600',
  description: 'Download Instagram Stories before they disappear. Save photos and video stories from any public account.',
  platformLabel: 'Instagram',
  placeholder: 'https://www.instagram.com/stories/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Instagram Story Downloader – Save Stories Free | PDFChampion" description="Download Instagram stories before they expire. Save photos and videos for free." canonical="/tools/video/instagram-story-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
