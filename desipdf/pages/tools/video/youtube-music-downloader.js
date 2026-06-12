import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube Music Downloader',
  icon: '🎼',
  color: 'from-emerald-500 to-teal-600',
  description: 'Download music from YouTube Music or any YouTube video. Save your favourite tracks as MP3 for offline listening.',
  platformLabel: 'YouTube Music',
  placeholder: 'https://music.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube Music Downloader – Free MP3 | PDFChampion" description="Download YouTube Music as MP3. Save songs for offline listening — free and fast." canonical="/tools/video/youtube-music-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
