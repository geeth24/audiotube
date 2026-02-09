from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict
from collections import defaultdict
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
    version="2.0.0",
)

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:3000",
    "https://audiotube.geethg.com",
    "https://audiotube.geeth.app",
    "https://at.geeth.app",
    "https://at-api.geeth.app",
    "https://youtube.geeth.app",
    "https://yt.geeth.app",
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
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

# Configure temporary URL settings
URL_EXPIRY_HOURS = 24
TEMP_DOWNLOADS = {}


# --- Rate Limiting ---

class RateLimiter:
    def __init__(self, max_requests: int = 15, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        self.requests[client_ip] = [
            t for t in self.requests[client_ip]
            if now - t < self.window_seconds
        ]
        if len(self.requests[client_ip]) >= self.max_requests:
            return False
        self.requests[client_ip].append(now)
        return True

    def get_retry_after(self, client_ip: str) -> int:
        if not self.requests[client_ip]:
            return 0
        oldest = min(self.requests[client_ip])
        return max(0, int(self.window_seconds - (time.time() - oldest)))


rate_limiter = RateLimiter(max_requests=15, window_seconds=60)
info_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)


def check_rate_limit(request: Request, limiter: RateLimiter = None):
    if limiter is None:
        limiter = rate_limiter
    client_ip = request.client.host if request.client else "unknown"
    if not limiter.is_allowed(client_ip):
        retry_after = limiter.get_retry_after(client_ip)
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )


# --- Video Info Cache ---
# caches yt-dlp info responses so /info + /download don't double-hit youtube

VIDEO_INFO_CACHE: Dict[str, dict] = {}
VIDEO_INFO_CACHE_TTL = 300  # 5 minutes


def get_cached_video_info(url: str) -> Dict:
    now = time.time()
    if url in VIDEO_INFO_CACHE:
        entry = VIDEO_INFO_CACHE[url]
        if now - entry["ts"] < VIDEO_INFO_CACHE_TTL:
            return entry["data"]
        del VIDEO_INFO_CACHE[url]

    # evict stale entries if cache gets big
    if len(VIDEO_INFO_CACHE) > 100:
        stale = [k for k, v in VIDEO_INFO_CACHE.items() if now - v["ts"] >= VIDEO_INFO_CACHE_TTL]
        for k in stale:
            del VIDEO_INFO_CACHE[k]

    data = get_video_info(url)
    VIDEO_INFO_CACHE[url] = {"data": data, "ts": now}
    return data


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
        "format": "bestvideo+bestaudio/best",
        "merge_output_format": "mp4",
    },
    "medium": {
        "format": "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
        "merge_output_format": "mp4",
    },
    "low": {
        "format": "bestvideo[height<=360]+bestaudio/best[height<=360]/best",
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


class VideoInfoRequest(BaseModel):
    url: str


class SubtitleRequest(BaseModel):
    url: str
    lang: str = "en"


class DownloadResponse(BaseModel):
    download_id: str
    format: str
    title: str
    duration: Optional[float]
    status: str
    download_url: str
    expires_at: datetime


def get_video_info(url: str) -> Dict:
    ydl_opts = {"quiet": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            return ydl.extract_info(url, download=False)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Error extracting video info: {str(e)}"
            )


def generate_download_id() -> str:
    return secrets.token_urlsafe(16)


def cleanup_expired_downloads():
    current_time = datetime.now()
    expired_keys = [
        k for k, v in TEMP_DOWNLOADS.items() if v["expires_at"] < current_time
    ]
    for k in expired_keys:
        filepath = TEMP_DOWNLOADS[k].get("filepath")
        if filepath and filepath.exists():
            try:
                filepath.unlink()
            except Exception:
                pass
        TEMP_DOWNLOADS.pop(k)


def format_duration(seconds: float) -> str:
    if not seconds:
        return "Unknown"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def format_filesize(size_bytes) -> str:
    if not size_bytes:
        return None
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    if size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def download_audio(
    url: str, format: str = "mp3", base_url: str = None
) -> DownloadResponse:
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
            filepath = Path(filename).with_suffix(f".{format}")

            expires_at = datetime.now() + timedelta(hours=URL_EXPIRY_HOURS)
            TEMP_DOWNLOADS[download_id] = {
                "filepath": filepath,
                "expires_at": expires_at,
            }

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
    if format not in VIDEO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Available formats: {', '.join(VIDEO_FORMATS.keys())}",
        )

    download_id = generate_download_id()

    with yt_dlp.YoutubeDL({"quiet": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    try:
        ydl_opts = {
            **VIDEO_FORMATS[format],
            "outtmpl": "%(title)s-video.%(ext)s",
            "quiet": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            ext = VIDEO_FORMATS[format].get("merge_output_format", "mp4")
            filepath = Path(filename).with_suffix(f".{ext}")

            expires_at = datetime.now() + timedelta(hours=URL_EXPIRY_HOURS)
            TEMP_DOWNLOADS[download_id] = {
                "filepath": filepath,
                "expires_at": expires_at,
            }

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
        try:
            fallback_opts = {
                "format": "bestvideo+bestaudio/best",
                "merge_output_format": "mp4",
                "outtmpl": "%(title)s-video-fallback.%(ext)s",
                "quiet": True,
            }

            with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                filepath = Path(filename).with_suffix(".mp4")

                expires_at = datetime.now() + timedelta(hours=URL_EXPIRY_HOURS)
                TEMP_DOWNLOADS[download_id] = {
                    "filepath": filepath,
                    "expires_at": expires_at,
                }

                cleanup_expired_downloads()

                return DownloadResponse(
                    download_id=download_id,
                    format="mp4",
                    title=info.get("title", "") + " (Fallback format used)",
                    duration=info.get("duration"),
                    status="completed",
                    download_url=f"{base_url}/download/{download_id}",
                    expires_at=expires_at,
                )
        except Exception as fallback_error:
            raise HTTPException(
                status_code=400,
                detail=f"Download failed: {str(primary_error)}. Fallback also failed: {str(fallback_error)}",
            )


def normalize_youtube_url(url: str) -> str:
    youtu_be_pattern = r"youtu\.be/([a-zA-Z0-9_-]+)"
    match = re.search(youtu_be_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    shorts_pattern = r"youtube\.com/shorts/([a-zA-Z0-9_-]+)"
    match = re.search(shorts_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    v_pattern = r"youtube\.com/v/([a-zA-Z0-9_-]+)"
    match = re.search(v_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    embed_pattern = r"youtube\.com/embed/([a-zA-Z0-9_-]+)"
    match = re.search(embed_pattern, url)
    if match:
        video_id = match.group(1)
        return f"https://www.youtube.com/watch?v={video_id}"

    return url


# --- Endpoints ---


@app.get("/formats")
async def list_formats():
    return {"formats": list(AUDIO_FORMATS.keys()), "default": "mp3"}


@app.get("/video-formats")
async def list_video_formats():
    return {"formats": list(VIDEO_FORMATS.keys()), "default": "mp4"}


@app.post("/info")
async def video_info(request: VideoInfoRequest, req: Request):
    check_rate_limit(req, info_rate_limiter)
    normalized_url = normalize_youtube_url(request.url)
    info = get_cached_video_info(normalized_url)

    # build available format list with resolution details
    available_formats = []
    seen = set()
    for f in info.get("formats", []):
        height = f.get("height")
        ext = f.get("ext")
        vcodec = f.get("vcodec", "none")
        acodec = f.get("acodec", "none")

        if vcodec != "none" and height and ext:
            key = f"{height}p-{ext}"
            if key not in seen:
                seen.add(key)
                available_formats.append({
                    "format_id": f.get("format_id"),
                    "ext": ext,
                    "resolution": f"{height}p",
                    "height": height,
                    "fps": f.get("fps"),
                    "filesize": format_filesize(f.get("filesize") or f.get("filesize_approx")),
                    "has_audio": acodec != "none",
                })

    available_formats.sort(key=lambda x: x.get("height", 0), reverse=True)

    # estimate sizes for audio formats
    duration = info.get("duration", 0)
    audio_sizes = {}
    if duration:
        audio_sizes = {
            "mp3": format_filesize(int(duration * 192 * 1000 / 8)),
            "m4a": format_filesize(int(duration * 192 * 1000 / 8)),
            "wav": format_filesize(int(duration * 1411 * 1000 / 8)),
            "opus": format_filesize(int(duration * 128 * 1000 / 8)),
            "vorbis": format_filesize(int(duration * 128 * 1000 / 8)),
            "aac": format_filesize(int(duration * 192 * 1000 / 8)),
        }

    # find available subtitle languages
    subtitles = list(info.get("subtitles", {}).keys())
    auto_subtitles = list(info.get("automatic_captions", {}).keys())

    return {
        "title": info.get("title", ""),
        "thumbnail": info.get("thumbnail", ""),
        "duration": info.get("duration"),
        "duration_formatted": format_duration(info.get("duration", 0)),
        "channel": info.get("channel", info.get("uploader", "")),
        "view_count": info.get("view_count"),
        "upload_date": info.get("upload_date"),
        "formats": available_formats,
        "audio_sizes": audio_sizes,
        "subtitles": subtitles,
        "auto_subtitles": auto_subtitles[:10],
    }


@app.post("/download-subtitle")
async def download_subtitle_endpoint(request: SubtitleRequest, req: Request):
    check_rate_limit(req)
    normalized_url = normalize_youtube_url(request.url)
    download_id = generate_download_id()
    base_url = os.getenv("BASE_URL", "http://localhost:8000")

    ydl_opts = {
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": [request.lang],
        "subtitlesformat": "srt",
        "skip_download": True,
        "outtmpl": str(TEMP_DIR / f"{download_id}.%(ext)s"),
        "quiet": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(normalized_url, download=True)

        # look for the subtitle file
        sub_path = None
        for ext in ["srt", "vtt", "ass"]:
            candidate = TEMP_DIR / f"{download_id}.{request.lang}.{ext}"
            if candidate.exists():
                sub_path = candidate
                break

        if not sub_path:
            raise HTTPException(status_code=404, detail=f"No subtitles found for language: {request.lang}")

        expires_at = datetime.now() + timedelta(hours=URL_EXPIRY_HOURS)
        TEMP_DOWNLOADS[download_id] = {
            "filepath": sub_path,
            "expires_at": expires_at,
        }

        return {
            "download_id": download_id,
            "title": info.get("title", ""),
            "language": request.lang,
            "download_url": f"{base_url}/download/{download_id}",
            "expires_at": expires_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Subtitle download failed: {str(e)}")


@app.post("/download-thumbnail")
async def download_thumbnail_endpoint(request: VideoInfoRequest, req: Request):
    check_rate_limit(req, info_rate_limiter)
    normalized_url = normalize_youtube_url(request.url)
    info = get_cached_video_info(normalized_url)

    thumbnails = info.get("thumbnails", [])
    # get highest quality thumbnail
    best_thumb = None
    if thumbnails:
        best_thumb = max(thumbnails, key=lambda t: t.get("width", 0) * t.get("height", 0))

    thumbnail_url = best_thumb.get("url") if best_thumb else info.get("thumbnail", "")

    return {
        "title": info.get("title", ""),
        "thumbnail_url": thumbnail_url,
        "thumbnails": [
            {"url": t.get("url"), "width": t.get("width"), "height": t.get("height")}
            for t in thumbnails
            if t.get("url") and t.get("width")
        ][-5:],
    }


@app.post("/download", response_model=DownloadResponse)
async def download_video_audio(video: VideoRequest, request: Request):
    check_rate_limit(request)
    normalized_url = normalize_youtube_url(str(video.url))
    get_cached_video_info(normalized_url)
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    return download_audio(normalized_url, video.format, base_url)


@app.post("/download-video", response_model=DownloadResponse)
async def download_video_endpoint(request: VideoDownloadRequest, req: Request):
    check_rate_limit(req)
    normalized_url = normalize_youtube_url(str(request.url))
    get_cached_video_info(normalized_url)
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    return download_video(normalized_url, request.format, base_url)


@app.get("/download/{download_id}")
async def get_download(download_id: str):
    cleanup_expired_downloads()

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
    return {"status": "ok", "version": "2.0.0"}


@app.get("/")
async def index():
    return {"message": "Welcome to AudioTube API", "version": "2.0.0"}
