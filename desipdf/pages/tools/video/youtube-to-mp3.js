import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube to MP3',
  icon: '🎵',
  color: 'from-amber-500 to-yellow-600',
  description: 'Convert any YouTube video to MP3 audio instantly. Extract high-quality audio in 128kbps or 320kbps for free.',
  platformLabel: 'YouTube',
  placeholder: 'https://www.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube to MP3 Converter – Free High Quality Audio | PDFChampion" description="Convert YouTube videos to MP3 audio. Download in 128kbps or 320kbps — free and fast." canonical="/tools/video/youtube-to-mp3" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
