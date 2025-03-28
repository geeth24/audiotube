/**
 * Client-side API utilities for direct API calls
 */

type DownloadParams = {
  url: string;
  format: string;
};

type DownloadResponse = {
  download_id: string;
  format: string;
  title: string;
  duration?: number;
  status: string;
  download_url: string;
  expires_at: string;
};

/**
 * Downloads audio from a YouTube URL
 */
export async function downloadAudio({ url, format }: DownloadParams): Promise<DownloadResponse> {
  const apiUrl = "https://audiotube-api.geethg.com/download";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, format }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetches available audio formats
 */
export async function getFormats(): Promise<string[]> {
  const response = await fetch("https://audiotube-api.geethg.com/formats");
  
  if (!response.ok) {
    throw new Error(`Failed to fetch formats: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.formats;
} 