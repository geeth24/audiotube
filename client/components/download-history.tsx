"use client"

import { useState, useEffect } from "react"
import { getHistory, type HistoryEntry } from "@/lib/history"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DownloadIcon, MusicIcon, FilmIcon, ClockIcon } from "lucide-react"

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DownloadHistory({ refreshKey }: { refreshKey?: number }) {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setHistory(getHistory())
  }, [refreshKey])

  if (history.length === 0) return null

  return (
    <Card size="sm" className="content-enter">
      <CardHeader>
        <CardTitle className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <ClockIcon className="size-3" />
          Recent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {history.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <Separator className="my-0.5" />}
              <a
                href={entry.downloadUrl}
                className="flex items-center gap-2.5 px-1 py-2 rounded-md hover:bg-muted/50 transition-colors group"
              >
                {entry.type === "audio"
                  ? <MusicIcon className="size-3 text-muted-foreground flex-shrink-0" />
                  : <FilmIcon className="size-3 text-muted-foreground flex-shrink-0" />
                }
                <span className="flex-1 min-w-0 text-xs truncate">{entry.title}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono flex-shrink-0">
                  {entry.format.toUpperCase()}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
                  {timeAgo(entry.timestamp)}
                </span>
                <DownloadIcon className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
