import VideoToolLayout from '../../../components/VideoToolLayout'
import SeoHead from '../../../components/SeoHead'

const tool = {
  name: 'YouTube Downloader',
  icon: '▶️',
  color: 'from-red-500 to-rose-600',
  description: 'Download any YouTube video in the highest available quality. Supports MP4 video and MP3 audio extraction — no signup required.',
  platformLabel: 'YouTube',
  placeholder: 'https://www.youtube.com/watch?v=...',
}

export default function Page() {
  return (
    <>
      <SeoHead title="YouTube Downloader – Free MP4 & MP3 Download | PDFChampion" description="Download YouTube videos in MP4, MP3, or any quality with our free YouTube Downloader. No signup, no watermarks." canonical="/tools/video/youtube-downloader" />
      <VideoToolLayout tool={tool} />
    </>
  )
}
