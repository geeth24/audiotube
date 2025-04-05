"use client"

import { Suspense, useState } from "react";
import AudioDownloadForm from "@/components/AudioDownloadForm"
import VideoDownloadForm from "@/components/VideoDownloadForm"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Headphones, Video } from "lucide-react"

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
  const [activeTab, setActiveTab] = useState("audio");
  
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
          <Tabs defaultValue="audio" value={activeTab} onValueChange={setActiveTab}>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight mb-2">
                    {activeTab === "audio" ? "Download Audio" : "Download Video"}
                  </h2>
                  {activeTab === "audio" ? (
                    <p className="text-muted-foreground">Extract high-quality audio from YouTube videos in your preferred format.</p>
                  ) : (
                    <p className="text-muted-foreground">Download YouTube videos in various formats and quality settings.</p>
                  )}
                </div>
                <TabsList>
                  <TabsTrigger value="audio" className="flex items-center gap-1">
                    <Headphones className="h-4 w-4" />
                    <span>Audio</span>
                  </TabsTrigger>
                  <TabsTrigger value="video" className="flex items-center gap-1">
                    <Video className="h-4 w-4" />
                    <span>Video</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {!youtubeUrl && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Pro tip: You can also use <span className="font-medium">audiotube.com/video-id</span> or <span className="font-medium">audiotube.com/full-youtube-url</span> to directly load a video.
                </p>
              )}
            </div>
            
            <div className="linear-card p-6">
              <TabsContent value="audio">
                <AudioDownloadForm initialUrl={youtubeUrl} />
              </TabsContent>
              <TabsContent value="video">
                <VideoDownloadForm initialUrl={youtubeUrl} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

