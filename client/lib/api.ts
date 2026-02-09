const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export type VideoInfo = {
  title: string
  thumbnail: string
  duration: number
  duration_formatted: string
  channel: string
  view_count: number | null
  upload_date: string | null
  formats: {
    format_id: string
    ext: string
    resolution: string
    height: number
    fps: number | null
    filesize: string | null
    has_audio: boolean
  }[]
  audio_sizes: Record<string, string>
  subtitles: string[]
  auto_subtitles: string[]
}

export type DownloadResponse = {
  download_id: string
  format: string
  title: string
  duration?: number
  status: string
  download_url: string
  expires_at: string
}

export type SubtitleResponse = {
  download_id: string
  title: string
  language: string
  download_url: string
  expires_at: string
}

export type ThumbnailResponse = {
  title: string
  thumbnail_url: string
  thumbnails: { url: string; width: number; height: number }[]
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : {})

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export const getFormats = () => request<{ formats: string[] }>("/formats").then(d => d.formats)
export const getVideoFormats = () => request<{ formats: string[] }>("/video-formats").then(d => d.formats)
export const getVideoInfo = (url: string) => request<VideoInfo>("/info", { url })
export const downloadAudio = (url: string, format: string) => request<DownloadResponse>("/download", { url, format })
export const downloadVideo = (url: string, format: string) => request<DownloadResponse>("/download-video", { url, format })
export const downloadSubtitle = (url: string, lang = "en") => request<SubtitleResponse>("/download-subtitle", { url, lang })
export const downloadThumbnail = (url: string) => request<ThumbnailResponse>("/download-thumbnail", { url })
