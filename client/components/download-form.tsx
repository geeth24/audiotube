"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Field, FieldLabel, FieldDescription, FieldContent } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DownloadIcon, LoaderIcon, LinkIcon, CopyIcon, CheckIcon,
  SubtitlesIcon, ImageIcon, ClipboardPasteIcon, FilmIcon, HeadphonesIcon,
} from "lucide-react"
import {
  getFormats, getVideoFormats, getVideoInfo, downloadAudio, downloadVideo,
  downloadSubtitle, downloadThumbnail, type VideoInfo,
} from "@/lib/api"
import { addToHistory } from "@/lib/history"
import VideoPreview from "./video-preview"
import DownloadProgress from "./download-progress"

type Mode = "audio" | "video"

const VIDEO_FORMAT_LABELS: Record<string, string> = {
  best: "Best Quality",
  mp4: "MP4 Standard",
  medium: "Medium (480p)",
  low: "Low (360p)",
  "audio-only": "Audio Only",
}

function isYt(url: string) {
  return /youtube\.com|youtu\.be/.test(url)
}

function parseError(msg: string): string {
  if (msg.includes("429")) return "Rate limited — wait a moment and retry."
  if (msg.includes("422")) return "Invalid URL."
  if (msg.includes("404")) return "Video not found."
  if (msg.includes("format")) return "Format unavailable — try Best Quality."
  return "Download failed. Try again."
}

export default function DownloadForm({
  mode,
  initialUrl = "",
  onDone,
}: {
  mode: Mode
  initialUrl?: string
  onDone?: () => void
}) {
  const [url, setUrl] = useState(initialUrl)
  const [format, setFormat] = useState(mode === "audio" ? "wav" : "best")
  const [formats, setFormats] = useState<string[]>([])
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [fetchingInfo, setFetchingInfo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ url: string; title: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [subLoading, setSubLoading] = useState(false)
  const [thumbLoading, setThumbLoading] = useState(false)
  const debounce = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    if (initialUrl && initialUrl !== url) setUrl(initialUrl)
  }, [initialUrl])

  useEffect(() => {
    const fetcher = mode === "audio" ? getFormats : getVideoFormats
    fetcher().then(f => {
      setFormats(f)
      setFormat(mode === "audio" ? "wav" : "best")
    }).catch(() => {})
  }, [mode])

  const fetchInfo = useCallback(async (u: string) => {
    if (!isYt(u)) return
    setFetchingInfo(true)
    try { setInfo(await getVideoInfo(u)) }
    catch { setInfo(null) }
    finally { setFetchingInfo(false) }
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!url || !isYt(url)) { setInfo(null); return }
    debounce.current = setTimeout(() => fetchInfo(url), 700)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [url, fetchInfo])

  useEffect(() => {
    setResult(null)
    setError(null)
    setInfo(null)
    if (url && isYt(url)) fetchInfo(url)
  }, [mode])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const fn = mode === "audio" ? downloadAudio : downloadVideo
      const res = await fn(url, format)
      setResult({ url: res.download_url, title: res.title })
      addToHistory({
        title: res.title,
        downloadUrl: res.download_url,
        format,
        type: mode,
        expiresAt: res.expires_at,
      })
      onDone?.()
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : ""))
    } finally {
      setLoading(false)
    }
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (isYt(text)) setUrl(text)
    } catch {}
  }

  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSub = async () => {
    if (!url) return
    setSubLoading(true)
    try {
      const r = await downloadSubtitle(url)
      window.open(r.download_url, "_blank")
    } catch {
      setError("No subtitles available for this video.")
    } finally {
      setSubLoading(false)
    }
  }

  const handleThumb = async () => {
    if (!url) return
    setThumbLoading(true)
    try {
      const r = await downloadThumbnail(url)
      if (r.thumbnail_url) window.open(r.thumbnail_url, "_blank")
    } catch {
      setError("Could not fetch thumbnail.")
    } finally {
      setThumbLoading(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5"
      onDrop={e => {
        e.preventDefault()
        const t = e.dataTransfer.getData("text/plain")
        if (t && isYt(t)) setUrl(t)
      }}
      onDragOver={e => e.preventDefault()}
    >
      {/* url */}
      <Field>
        <FieldLabel className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          YouTube URL
        </FieldLabel>
        <FieldContent>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <LinkIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste a YouTube link or drop it here"
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={paste} variant="ghost">
                <ClipboardPasteIcon className="size-3.5" />
                Paste
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription className="text-[11px]">
            Supports youtube.com, youtu.be, and YouTube Shorts
          </FieldDescription>
        </FieldContent>
      </Field>

      {/* fetching indicator */}
      {fetchingInfo && (
        <div className="content-enter flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderIcon className="size-3 animate-spin" /> Loading video info…
        </div>
      )}

      {/* video preview */}
      {info && !fetchingInfo && (
        <VideoPreview
          info={info}
          estimatedSize={mode === "audio" ? info.audio_sizes?.[format] : null}
        />
      )}

      {/* format */}
      <Field>
        <FieldLabel className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          {mode === "audio" ? "Format" : "Quality"}
        </FieldLabel>
        <FieldContent>
          <Select value={format} onValueChange={(v) => { if (v) setFormat(v) }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formats.map(f => (
                <SelectItem key={f} value={f}>
                  {mode === "video"
                    ? VIDEO_FORMAT_LABELS[f] || f.toUpperCase()
                    : (
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs">{f.toUpperCase()}</span>
                        {info?.audio_sizes?.[f] && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
                            ~{info.audio_sizes[f]}
                          </Badge>
                        )}
                      </span>
                    )
                  }
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mode === "video" && info && info.formats.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {info.formats.slice(0, 5).map(f => (
                <Badge key={f.format_id} variant="outline" className="text-[9px] h-4 px-1.5 font-mono">
                  {f.resolution}
                </Badge>
              ))}
            </div>
          )}
        </FieldContent>
      </Field>

      {/* extras */}
      {info && !loading && (
        <>
          <Separator />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleSub} disabled={subLoading} className="flex-1">
              {subLoading ? <LoaderIcon className="size-3 animate-spin" /> : <SubtitlesIcon className="size-3" />}
              <span className="text-[11px]">Subtitles</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleThumb} disabled={thumbLoading} className="flex-1">
              {thumbLoading ? <LoaderIcon className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
              <span className="text-[11px]">Thumbnail</span>
            </Button>
          </div>
        </>
      )}

      {/* submit / progress */}
      {loading ? (
        <DownloadProgress active />
      ) : (
        <Button type="submit" className="w-full" size="lg" disabled={loading || !url.trim()}>
          {mode === "audio"
            ? <><HeadphonesIcon className="size-4" /> Download Audio</>
            : <><FilmIcon className="size-4" /> Download Video</>
          }
        </Button>
      )}

      {/* error */}
      {error && (
        <div className="content-enter text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2.5">
          {error}
        </div>
      )}

      {/* result */}
      {result && (
        <Card className="content-enter download-glow !py-3">
          <CardContent>
            <p className="text-xs text-muted-foreground truncate mb-2">{result.title}</p>
            <div className="flex items-center justify-between gap-2">
              <a
                href={result.url}
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1.5"
              >
                <DownloadIcon className="size-3.5" />
                Download file
              </a>
              <Button type="button" variant="ghost" size="xs" onClick={copy}>
                {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  )
}
