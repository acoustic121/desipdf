import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Instagram Photo Downloader',
  icon: '🖼️',
  color: 'from-pink-400 to-rose-500',
  description: 'Download Instagram photos and images in original full resolution. Save any public Instagram post image.',
  platformLabel: 'Instagram',
  placeholder: 'https://www.instagram.com/p/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Instagram Photo Downloader – Save Full Res Images | PDFChampion" description="Download Instagram photos in original full resolution. Free, fast, no signup." canonical="/tools/video/instagram-photo-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
