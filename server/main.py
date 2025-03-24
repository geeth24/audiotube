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


class VideoRequest(BaseModel):
    url: HttpUrl
    format: str = "mp3"


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


@app.get("/formats")
async def list_formats():
    """List all available audio formats"""
    return {"formats": list(AUDIO_FORMATS.keys()), "default": "mp3"}


@app.post("/download", response_model=DownloadResponse)
async def download_video(video: VideoRequest, background_tasks: BackgroundTasks):
    """Download a YouTube video as audio and get temporary download URL"""
    # Verify video exists and is accessible
    info = get_video_info(str(video.url))

    # Get base URL for download link
    base_url = os.getenv("BASE_URL", "http://localhost:8000")

    # Start download in background
    response = download_audio(str(video.url), video.format, base_url)
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
