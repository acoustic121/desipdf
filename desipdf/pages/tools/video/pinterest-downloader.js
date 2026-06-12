import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Pinterest Downloader',
  icon: '📌',
  color: 'from-red-600 to-rose-700',
  description: 'Download Pinterest videos, GIFs, and images in original quality. Save any public Pinterest pin to your device.',
  platformLabel: 'Pinterest',
  placeholder: 'https://www.pinterest.com/pin/...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Pinterest Downloader – Save Videos, GIFs & Images | PDFChampion" description="Download Pinterest videos, GIFs and images in original quality. Free and instant." canonical="/tools/video/pinterest-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
