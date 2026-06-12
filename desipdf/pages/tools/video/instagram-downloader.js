import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Instagram Downloader',
  icon: '📸',
  color: 'from-pink-500 to-fuchsia-600',
  description: 'Download any public Instagram content — videos, reels, photos, stories, and carousels. No login required.',
  platformLabel: 'Instagram',
  placeholder: 'https://www.instagram.com/reel/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Instagram Downloader – Free Videos, Reels & Photos | PDFChampion" description="Download Instagram videos, reels, photos and stories for free. No login needed." canonical="/tools/video/instagram-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
