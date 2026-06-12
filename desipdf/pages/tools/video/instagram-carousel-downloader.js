import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Instagram Carousel Downloader',
  icon: '🎠',
  color: 'from-pink-500 to-fuchsia-600',
  description: 'Download all photos and videos from an Instagram carousel post. Save the entire album with one click.',
  platformLabel: 'Instagram',
  placeholder: 'https://www.instagram.com/p/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Instagram Carousel Downloader – Save All Photos & Videos | PDFChampion" description="Download entire Instagram carousel albums. Save all photos and videos at once." canonical="/tools/video/instagram-carousel-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
