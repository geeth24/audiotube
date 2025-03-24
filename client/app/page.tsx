"use client"

import { Suspense, useState } from "react";
import AudioDownloadForm from "@/components/AudioDownloadForm"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useSearchParams } from "next/navigation"

function YouTubeUrlHandler({ onUrlFound }: { onUrlFound: (url: string) => void }) {
  const searchParams = useSearchParams();
  
  // Extract URL from search params
  const encodedUrl = searchParams.get('url') || '';
  if (encodedUrl) {
    try {
      onUrlFound(decodeURIComponent(encodedUrl));
    } catch (e) {
      console.error("Error decoding URL:", e);
      onUrlFound(encodedUrl);
    }
  }
  
  return null;
}

export default function Home() {
  // Using useState without initial search params processing
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Wrap the component using useSearchParams in Suspense */}
      <Suspense fallback={null}>
        <YouTubeUrlHandler onUrlFound={setYoutubeUrl} />
      </Suspense>
      
      <header className="border-b border-border pb-5 mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-medium text-lg">A</span>
            </div>
            <h1 className="text-xl font-medium tracking-tight">AudioTube</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <main>
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-medium tracking-tight mb-2">Download Audio</h2>
            <p className="text-muted-foreground">Extract high-quality audio from YouTube videos in your preferred format.</p>
            {!youtubeUrl && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Pro tip: You can also use <span className="font-medium">audiotube.com/video-id</span> or <span className="font-medium">audiotube.com/full-youtube-url</span> to directly load a video.
              </p>
            )}
          </div>
          
          <div className="linear-card p-6">
            <AudioDownloadForm initialUrl={youtubeUrl} />
          </div>
        </div>
      </main>
    </div>
  )
}

