"use client"

import type { VideoInfo } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

function formatViews(n: number | null): string {
  if (!n) return ""
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`
  return `${n} views`
}

export default function VideoPreview({
  info,
  estimatedSize,
}: {
  info: VideoInfo
  estimatedSize?: string | null
}) {
  return (
    <Card size="sm" className="content-enter !py-0">
      <CardContent className="!p-3">
        <div className="flex gap-3">
          <div className="relative flex-shrink-0 w-[130px] h-[74px] rounded-md overflow-hidden bg-muted">
            {info.thumbnail && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={info.thumbnail} alt="" className="w-full h-full object-cover" />
            )}
            {info.duration_formatted && (
              <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                {info.duration_formatted}
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
          </div>
          <div className="flex-1 min-w-0 py-0.5 space-y-1.5">
            <p className="text-sm font-medium leading-snug line-clamp-2">{info.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {info.channel}
              {info.view_count ? ` · ${formatViews(info.view_count)}` : ""}
            </p>
            <div className="flex flex-wrap gap-1">
              {info.formats.slice(0, 4).map(f => (
                <Badge key={f.format_id} variant="outline" className="text-[9px] h-4 px-1.5 font-mono">
                  {f.resolution}
                </Badge>
              ))}
              {estimatedSize && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
                  ~{estimatedSize}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
