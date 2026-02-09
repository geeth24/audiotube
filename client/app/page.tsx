"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
  DropdownMenuGroup, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import DownloadForm from "@/components/download-form"
import DownloadHistory from "@/components/download-history"
import { clearHistory } from "@/lib/history"
import {
  Disc3Icon, HeadphonesIcon, FilmIcon,
  SettingsIcon, SunIcon, MoonIcon, MonitorIcon, Trash2Icon,
} from "lucide-react"

type Mode = "audio" | "video"
type Theme = "light" | "dark" | "system"

function UrlHandler({ onUrl }: { onUrl: (u: string) => void }) {
  const params = useSearchParams()
  const raw = params.get("url") || ""
  useEffect(() => {
    if (raw) {
      try { onUrl(decodeURIComponent(raw)) }
      catch { onUrl(raw) }
    }
  }, [raw, onUrl])
  return null
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const s = localStorage.getItem("theme")
  if (s === "light" || s === "dark") return s
  return "system"
}

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  if (t === "system") localStorage.removeItem("theme")
  else localStorage.setItem("theme", t)
}

export default function Home() {
  const [url, setUrl] = useState("")
  const [mode, setMode] = useState<Mode>("audio")
  const [historyKey, setHistoryKey] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [theme, setTheme] = useState<Theme>("system")
  const [clearOpen, setClearOpen] = useState(false)

  const refreshHistory = useCallback(() => setHistoryKey(k => k + 1), [])
  const handleUrl = useCallback((u: string) => setUrl(u), [])

  useEffect(() => { setTheme(getStoredTheme()) }, [])

  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const fn = () => applyTheme("system")
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [theme])

  const handleThemeChange = (val: string) => {
    const t = val as Theme
    setTheme(t)
    applyTheme(t)
  }

  const handleClear = () => {
    clearHistory()
    refreshHistory()
    setClearOpen(false)
  }

  // clipboard auto-detect
  useEffect(() => {
    const onFocus = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (/youtube\.com|youtu\.be/.test(text) && text !== url) setUrl(text)
      } catch {}
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [url])

  // drag indicator
  useEffect(() => {
    let timeout: NodeJS.Timeout
    const enter = (e: DragEvent) => { e.preventDefault(); setDragging(true); clearTimeout(timeout) }
    const over = (e: DragEvent) => { e.preventDefault(); clearTimeout(timeout) }
    const leave = () => { timeout = setTimeout(() => setDragging(false), 100) }
    const drop = () => setDragging(false)
    document.addEventListener("dragenter", enter)
    document.addEventListener("dragover", over)
    document.addEventListener("dragleave", leave)
    document.addEventListener("drop", drop)
    return () => {
      document.removeEventListener("dragenter", enter)
      document.removeEventListener("dragover", over)
      document.removeEventListener("dragleave", leave)
      document.removeEventListener("drop", drop)
    }
  }, [])

  return (
    <div className={`min-h-screen transition-all ${dragging ? "drop-active" : ""}`}>
      <Suspense fallback={null}>
        <UrlHandler onUrl={handleUrl} />
      </Suspense>

      <div className="accent-line" />

      <div className="max-w-lg mx-auto px-4 pt-6 pb-12">
        {/* header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <Disc3Icon className="size-4 text-primary-foreground spin-slow" />
            </div>
            <span className="text-lg font-semibold tracking-tight font-mono">
              AudioTube
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <SettingsIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
                  <DropdownMenuRadioItem value="light">
                    <SunIcon className="size-3.5" /> Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <MoonIcon className="size-3.5" /> Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <MonitorIcon className="size-3.5" /> System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setClearOpen(true)}>
                <Trash2Icon className="size-3.5" /> Clear History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* main card */}
        <Card size="sm" className="mb-6">
          <CardContent className="stagger space-y-0">
            <div className="flex gap-1 p-1 bg-muted rounded-lg mb-5">
              <Button
                variant={mode === "audio" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("audio")}
                className="flex-1"
              >
                <HeadphonesIcon className="size-3.5" />
                Audio
              </Button>
              <Button
                variant={mode === "video" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("video")}
                className="flex-1"
              >
                <FilmIcon className="size-3.5" />
                Video
              </Button>
            </div>

            <Separator className="mb-5" />

            <DownloadForm mode={mode} initialUrl={url} onDone={refreshHistory} />
          </CardContent>
        </Card>

        {/* history */}
        <DownloadHistory refreshKey={historyKey} />

        {/* tip */}
        <p className="text-center text-[10px] text-muted-foreground/40 mt-10 select-none font-mono">
          audiotube.com/VIDEO_ID → direct load
        </p>
      </div>

      {/* clear history confirm */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear history?</AlertDialogTitle>
            <AlertDialogDescription>
              All recent downloads will be removed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClear}>
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
