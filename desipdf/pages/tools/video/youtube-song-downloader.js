import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube Song Downloader',
  icon: '🎶',
  color: 'from-purple-500 to-violet-600',
  description: 'Download songs from YouTube as high-quality MP3 audio files. Perfect for saving music, podcasts, and audio content.',
  platformLabel: 'YouTube',
  placeholder: 'https://www.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube Song Downloader – Save Songs as MP3 | PDFChampion" description="Download YouTube songs as MP3. High quality audio extraction, free and instant." canonical="/tools/video/youtube-song-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
