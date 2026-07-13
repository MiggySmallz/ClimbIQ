# Artifact transfer behind one interface (spec §8.1): presigned HTTP(S)
# GET/PUT in production, file:// or plain local paths for local dev. No cloud
# SDKs here — presigned URLs are just HTTP.
import shutil
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


def _local_path(url: str) -> Path | None:
    parsed = urlparse(url)
    if parsed.scheme in ('http', 'https'):
        return None
    if parsed.scheme == 'file':
        return Path(parsed.path)
    # No scheme (or a Windows drive letter): treat as a plain local path.
    return Path(url)


def fetch(url: str, dest: Path) -> None:
    """Download (or copy) the video to a local working path, streaming —
    never the whole file in RAM (spec §3)."""
    src = _local_path(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src is not None:
        shutil.copyfile(src, dest)
        return
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest, 'wb') as out:
        shutil.copyfileobj(resp, out, length=1 << 20)


def put(url: str, src: Path, content_type: str) -> None:
    """Upload (or copy) an artifact to its presigned PUT URL."""
    dest = _local_path(url)
    if dest is not None:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        return
    size = src.stat().st_size
    with open(src, 'rb') as body:
        req = urllib.request.Request(
            url,
            data=body,
            method='PUT',
            headers={'Content-Type': content_type, 'Content-Length': str(size)},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status not in (200, 201, 204):
                raise RuntimeError(f'PUT failed with status {resp.status}')
