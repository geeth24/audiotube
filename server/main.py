from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict
import secrets
import time
from datetime import datetime, timedelta
import yt_dlp
import os
from pathlib import Path
import re

app = FastAPI(
    title="AudioTube API",
    description="A service to download YouTube videos as audio files in various formats",
    version="1.0.0",
)

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:3000",
    "https://audiotube.geethg.com",
    "https://audiotube.geeth.app",
    "https://at.geeth.app",
    "https://youtube.geeth.app",
    "https://yt.geeth.app/*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure directories
DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

# Configure temporary URL settings
URL_EXPIRY_HOURS = 24
TEMP_DOWNLOADS = {}

# Available audio formats and their yt-dlp format codes
AUDIO_FORMATS = {
    "mp3": {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
    },
    "m4a": {
        "format": "bestaudio[ext=m4a]",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "m4a",
                "preferredquality": "192",
            }
        ],
    },
    "wav": {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ],
    },
    "opus": {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "opus",
            }
        ],
    },
    "vorbis": {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "vorbis",
            }
        ],
    },
    "aac": {
        "format": "bestaudio[ext=m4a]",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "aac",
            }
        ],
    },
}

# Video format options
VIDEO_FORMATS = {
    "mp4": {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "merge_output_format": "mp4",
    },
    "best": {
        "format": "best",
        "merge_output_format": "mp4",
    },
    "medium": {
        "format": "18/best[height<=480]",  # Uses format 18 which is 480p MP4
        "merge_output_format": "mp4",
    },
    "low": {
        "format": "17/best[height<=360]",  # Uses format 17 which is 360p MP4
        "merge_output_format": "mp4",
    },
    "audio-only": {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
            }
        ],
    },
}


class VideoRequest(BaseModel):
    url: HttpUrl
    format: str = "mp3"


class VideoDownloadRequest(BaseModel):
    url: str
    format: str = "mp4"


class DownloadResponse(BaseModel):
    download_id: str
    format: str
    title: str
    duration: Optional[float]
    status: str
    download_url: str
    expires_at: datetime


def get_video_info(url: str) -> Dict:
    """Get video information using yt-dlp"""
    ydl_opts = {"quiet": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            return ydl.extract_info(url, download=False)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Error extracting video info: {str(e)}"
            )


def generate_download_id() -> str:
    """Generate a secure random download ID"""
    return secrets.token_urlsafe(16)


def cleanup_expired_downloads():
    """Remove expired download entries"""
    current_time = datetime.now()
    expired_keys = [
        k for k, v in TEMP_DOWNLOADS.items() if v["expires_at"] < current_time
    ]
    for k in expired_keys:
        TEMP_DOWNLOADS.pop(k)


def download_audio(
    url: str, format: str = "mp3", base_url: str = None
) -> DownloadResponse:
    """Download audio from YouTube URL and create temporary download link"""
    if format not in AUDIO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Available formats: {', '.join(AUDIO_FORMATS.keys())}",
        )

    download_id = generate_download_id()

    ydl_opts = {
        **AUDIO_FORMATS[format],
        "outtmpl": "%(title)s-audio.%(ext)s",
        "quiet": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

            # Update filename extension based on selected format
            filepath = Path(filename).with_suffix(f".{format}")

            # Create temporary download entry
            expires_at = datetime.now() + timedelta(hours=URL_EXPIRY_HOURS)
            TEMP_DOWNLOADS[download_id] = {
                "filepath": filepath,
                "expires_at": expires_at,
            }

            # Clean up expired downloads
            cleanup_expired_downloads()

            return DownloadResponse(
                download_id=download_id,
                format=format,
                title=info.get("title", ""),
                duration=info.get("duration"),
                status="completed",
                download_url=f"{base_url}/download/{download_id}",
                expires_at=expires_at,
            )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")


def download_video(
    url: str, format: str = "mp4", base_url: str = None
) -> DownloadResponse:
    """Download video from YouTube URL and create temporary download link"""
    if format not in VIDEO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Available formats: {', '.join(VIDEO_FORMATS.keys())}",
        )

    download_id = generate_download_id()

    # First, get available formats for this video
    with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    # Try primary format
    try:
        ydl_opts = {
            **VIDEO_FORMATS[format],
            "outtmpl": "%(title)s-video.%(ext)s",
            "quiet": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

            # Update filename extension based on selected format
            ext = VIDEO_FORMATS[format].get("merge_output_format", "mp4")
            filepath = Path(filename).with_suffix(f".{ext}")

            # Create temporary download entry
            expires_at = datetime.now() + timedelta(hours=URL_EXPIRY_HOURS)
            TEMP_DOWNLOADS[download_id] = {
                "filepath": filepath,
                "expires_at": expires_at,
            }

            # Clean up expired downloads
            cleanup_expired_downloads()

            return DownloadResponse(
                download_id=download_id,
                format=format,
                title=info.get("title", ""),
                duration=info.get("duration"),
                status="completed",
                download_url=f"{base_url}/download/{download_id}",
                expires_at=expires_at,
            )
    except Exception as primary_error:
        # If the specific format fails, try a more general/fallback format
        try:
            # Fallback to best available format
            fallback_opts = {
                "format": "best",
                "merge_output_format": "mp4",
                "outtmpl": "%(title)s-video-fallback.%(ext)s",
                "quiet": True,
            }

            with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)

                # Always use mp4 for fallback for better compatibility
                filepath = Path(filename).with_suffix(".mp4")

                # Create temporary download entry
                expires_at = datetime.now() + timedelta(hours=URL_EXPIRY_HOURS)
                TEMP_DOWNLOADS[download_id] = {
                    "filepath": filepath,
                    "expires_at": expires_at,
                }

                # Clean up expired downloads
                cleanup_expired_downloads()

                return DownloadResponse(
                    download_id=download_id,
                    format="mp4",  # Using mp4 as fallback format
                    title=info.get("title", "") + " (Fallback format used)",
                    duration=info.get("duration"),
                    status="completed",
                    download_url=f"{base_url}/download/{download_id}",
                    expires_at=expires_at,
                )
        except Exception as fallback_error:
            # If even the fallback fails, raise the original error
            raise HTTPException(
                status_code=400,
                detail=f"Download failed: {str(primary_error)}. Fallback also failed: {str(fallback_error)}",
            )


def normalize_youtube_url(url: str) -> str:
    """Normalize YouTube URLs to a standard format"""
    # Handle youtu.be short links
    youtu_be_pattern = r"youtu\.be/([a-zA-Z0-9_-]+)"
    match = re.search(youtu_be_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    # Handle youtube.com/shorts
    shorts_pattern = r"youtube\.com/shorts/([a-zA-Z0-9_-]+)"
    match = re.search(shorts_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    # Handle youtube.com/v/ format
    v_pattern = r"youtube\.com/v/([a-zA-Z0-9_-]+)"
    match = re.search(v_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    # Handle youtube.com/embed/ format
    embed_pattern = r"youtube\.com/embed/([a-zA-Z0-9_-]+)"
    match = re.search(embed_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    # Already in standard format or not recognized
    return url


@app.get("/formats")
async def list_formats():
    """List all available audio formats"""
    return {"formats": list(AUDIO_FORMATS.keys()), "default": "mp3"}


@app.get("/video-formats")
async def list_video_formats():
    """List all available video formats"""
    return {"formats": list(VIDEO_FORMATS.keys()), "default": "mp4"}


@app.post("/download", response_model=DownloadResponse)
async def download_video_audio(video: VideoRequest, background_tasks: BackgroundTasks):
    """Download a YouTube video as audio and get temporary download URL"""
    # Normalize the URL
    normalized_url = normalize_youtube_url(str(video.url))

    # Verify video exists and is accessible
    info = get_video_info(normalized_url)

    # Get base URL for download link
    base_url = os.getenv("BASE_URL", "http://localhost:8000")

    # Start download in background
    response = download_audio(normalized_url, video.format, base_url)
    return response


@app.post("/download-video", response_model=DownloadResponse)
async def download_video_endpoint(
    request: VideoDownloadRequest, background_tasks: BackgroundTasks
):
    """Download a YouTube video and get temporary download URL"""
    # Normalize the URL
    normalized_url = normalize_youtube_url(str(request.url))

    # Verify video exists and is accessible
    info = get_video_info(normalized_url)

    # Get base URL for download link
    base_url = os.getenv("BASE_URL", "http://localhost:8000")

    # Start download in background
    response = download_video(normalized_url, request.format, base_url)
    return response


@app.get("/download/{download_id}")
async def get_download(download_id: str):
    """Download file using temporary download ID"""
    # Clean up expired downloads
    cleanup_expired_downloads()

    # Check if download ID exists and is valid
    if download_id not in TEMP_DOWNLOADS:
        raise HTTPException(status_code=404, detail="Download not found or expired")

    download_info = TEMP_DOWNLOADS[download_id]
    if download_info["expires_at"] < datetime.now():
        TEMP_DOWNLOADS.pop(download_id)
        raise HTTPException(status_code=404, detail="Download link expired")

    filepath = download_info["filepath"]
    if not filepath.exists():
        TEMP_DOWNLOADS.pop(download_id)
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=filepath, filename=filepath.name, media_type="application/octet-stream"
    )


@app.get("/downloads")
async def list_downloads():
    """List all downloaded files"""
    files = []
    for file in DOWNLOAD_DIR.glob("*"):
        if file.is_file():
            files.append(
                {
                    "filename": file.name,
                    "size": file.stat().st_size,
                    "created": file.stat().st_ctime,
                }
            )
    return {"downloads": files}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.get("/")
async def index():
    """Index page"""
    return {"message": "Welcome to AudioTube API"}
