"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

const STAGES = [
  { label: "Fetching info", ms: 2000 },
  { label: "Downloading", ms: 8000 },
  { label: "Converting", ms: 5000 },
  { label: "Finalizing", ms: 2000 },
]

const TOTAL = STAGES.reduce((s, x) => s + x.ms, 0)
const SEGS = 28

export default function DownloadProgress({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!active) { setProgress(0); setStage(0); return }
    let elapsed = 0
    const iv = setInterval(() => {
      elapsed += 80
      setProgress(Math.min((elapsed / TOTAL) * 100, 92))
      let acc = 0
      for (let i = 0; i < STAGES.length; i++) {
        acc += STAGES[i].ms
        if (elapsed < acc) { setStage(i); break }
        if (i === STAGES.length - 1) setStage(i)
      }
    }, 80)
    return () => clearInterval(iv)
  }, [active])

  if (!active) return null

  const filled = Math.floor((progress / 100) * SEGS)

  return (
    <div className="content-enter space-y-3 py-1">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px] h-5 font-mono gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
          {STAGES[stage]?.label}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="flex gap-[2px]">
        {Array.from({ length: SEGS }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-[7px] rounded-[2px] transition-all duration-100"
            style={{
              backgroundColor: i < filled
                ? `oklch(0.65 0.24 ${16 + (i / SEGS) * 8} / ${0.5 + (i / SEGS) * 0.5})`
                : "var(--muted)",
              boxShadow: i === filled - 1 ? "0 0 8px oklch(0.65 0.24 17 / 0.4)" : "none",
            }}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {STAGES.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
              i < stage ? "bg-primary" : i === stage ? "bg-primary pulse-dot" : "bg-muted-foreground/20"
            }`} />
            <span className={i <= stage ? "text-foreground" : "text-muted-foreground/40"}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
