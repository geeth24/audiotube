export type HistoryEntry = {
  id: string
  title: string
  downloadUrl: string
  format: string
  type: "audio" | "video"
  timestamp: number
  expiresAt: string
}

const KEY = "audiotube_history"
const MAX = 20

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const entries: HistoryEntry[] = JSON.parse(raw)
    return entries.filter(e => new Date(e.expiresAt).getTime() > Date.now())
  } catch {
    return []
  }
}

export function addToHistory(entry: Omit<HistoryEntry, "id" | "timestamp">): void {
  if (typeof window === "undefined") return
  try {
    const history = getHistory()
    const item: HistoryEntry = { ...entry, id: crypto.randomUUID(), timestamp: Date.now() }
    localStorage.setItem(KEY, JSON.stringify([item, ...history].slice(0, MAX)))
  } catch {}
}

export function clearHistory(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY)
}
