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
 * Downloads video from a YouTube URL
 */
export async function downloadVideo({ url, format }: DownloadParams): Promise<DownloadResponse> {
  const apiUrl = "https://audiotube-api.geethg.com/download-video";
  
  const requestBody = { url, format };
  console.log("Sending video download request:", requestBody);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", response.status, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Video download error:", error);
    throw error;
  }
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

/**
 * Fetches available video formats
 */
export async function getVideoFormats(): Promise<string[]> {
  const response = await fetch("https://audiotube-api.geethg.com/video-formats");
  
  if (!response.ok) {
    throw new Error(`Failed to fetch video formats: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.formats;
} 