"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Loader2 } from "lucide-react"

type FormData = {
  url: string
  format: string
}

export default function AudioDownloadForm() {
  const [formats, setFormats] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const { register, handleSubmit } = useForm<FormData>()
  const { toast } = useToast()

  // Fetch available formats when component mounts
  useEffect(() => {
    fetch("https://audiotube-api.geethg.com/formats")
      .then((res) => res.json())
      .then((data) => setFormats(data.formats))
      .catch((error) => toast({ title: "Error", description: `Failed to fetch formats ${error}`, variant: "destructive" }))
  }, [])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setDownloadUrl(null)

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to process request")
      }

      const result = await response.json()
      setDownloadUrl(result.download_url)
      toast({
        title: "Success",
        description: "Your audio is ready for download.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to process your request. Please try again. ${error}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="url">YouTube URL</Label>
        <Input id="url" {...register("url", { required: true })} placeholder="https://www.youtube.com/watch?v=..." />
      </div>
      <div>
        <Label htmlFor="format">Audio Format</Label>
        <Select {...register("format")} defaultValue="wav">
          <SelectTrigger>
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            {formats.map((format) => (
              <SelectItem key={format} value={format}>
                {format}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
        {isLoading ? <Loader2 className="animate-spin mr-2" /> : ""}
        {isLoading ? "Processing..." : "Download Audio"}
      </Button>
      </div>

      {downloadUrl && (
        <Alert>
          <AlertTitle>Download Ready</AlertTitle>
          <AlertDescription>
            Your audio is ready.{" "}
            <Link href={downloadUrl} className="font-medium underline">
              Click here to download
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </form>
  )
}

