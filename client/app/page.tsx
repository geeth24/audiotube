import AudioDownloadForm from "@/components/AudioDownloadForm"
import { ThemeToggle } from "@/components/ThemeToggle"

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">AudioTube</h1>
        <ThemeToggle />
      </div>
      <AudioDownloadForm />
    </div>
  )
}

