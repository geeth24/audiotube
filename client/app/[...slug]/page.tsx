"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function CatchAllRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  useEffect(() => {
    const rawUrl = resolvedParams.slug.join("/") + window.location.search;
    console.log(rawUrl);

    const youtubeUrl =
      rawUrl.includes("youtube.com") || rawUrl.includes("youtu.be")
        ? rawUrl
        : `https://www.youtube.com/watch?v=${rawUrl}`;

    console.log(youtubeUrl);
    router.replace(`/?url=${encodeURIComponent(youtubeUrl)}`);
  }, [router, resolvedParams.slug]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
