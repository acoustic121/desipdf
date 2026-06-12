import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube Audio Downloader',
  icon: '🔊',
  color: 'from-amber-500 to-yellow-600',
  description: 'Download audio from any YouTube video in high quality. Extract clean audio tracks as MP3 or other formats.',
  platformLabel: 'YouTube',
  placeholder: 'https://www.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube Audio Downloader – Extract Audio Free | PDFChampion" description="Download audio from YouTube videos as MP3. Free, fast, high quality audio extraction." canonical="/tools/video/youtube-audio-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
