"use client"

import { useEffect, use } from "react"
import { useRouter } from "next/navigation"

export default function CatchAllRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = use(params)
  const router = useRouter()

  useEffect(() => {
    const raw = slug.join("/") + window.location.search
    const youtubeUrl =
      raw.includes("youtube.com") || raw.includes("youtu.be")
        ? raw
        : `https://www.youtube.com/watch?v=${raw}`

    router.replace(`/?url=${encodeURIComponent(youtubeUrl)}`)
  }, [router, slug])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  )
}
