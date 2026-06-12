import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'Instagram Profile Downloader',
  icon: '👤',
  color: 'from-violet-500 to-purple-600',
  description: 'Download photos from an Instagram profile. Save profile pictures and public post images.',
  platformLabel: 'Instagram',
  placeholder: 'https://www.instagram.com/username/',
}

export default function Page() {
  return (
    <>
      <SeoHead title="Instagram Profile Downloader – Save Profile Media | PDFChampion" description="Download Instagram profile photos and media. Free and fast." canonical="/tools/video/instagram-profile-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
