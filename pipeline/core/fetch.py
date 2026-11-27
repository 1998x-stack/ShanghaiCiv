"""Optional HTTP fetch engine; NOT wired to any real source in P03.

A caller MUST supply explicit allowed rights before fetching. In contrast to
fixture adapters, network mode defaults off. Never log URL query secrets.
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
from pathlib import Path

from pipeline.core.source import SourceInfo
from pipeline.core.store import atomic_write, read_json, sha256, write_json


def fetch_http(info: SourceInfo, destination: Path, *, offline: bool = True,
               force: bool = False, retries: int = 2) -> Path:
    info.assert_access(public_release=False)
    if info.synthetic:
        raise ValueError("Synthetic fixtures must use FixtureSource")
    if offline:
        raise PermissionError("OFFLINE_NETWORK_REQUEST_BLOCKED")
    path = Path(destination)
    manifest = path.with_suffix(path.suffix + ".manifest.json")
    if path.exists() and manifest.exists() and not force:
        previous = read_json(manifest)
        if sha256(path.read_bytes()) != previous.get("sha256"):
            raise ValueError("SHA256_MISMATCH")
        return path
    if not info.url.startswith("https://"):
        raise ValueError("HTTPS_ONLY")
    error = None
    for attempt in range(max(1, retries + 1)):
        try:
            request = urllib.request.Request(info.url, headers={"User-Agent": "ShanghaiCiv-data/0.1"})
            with urllib.request.urlopen(request, timeout=30) as resp:
                payload = resp.read()
                if not payload:
                    raise ValueError("EMPTY_SOURCE_PAYLOAD")
                content_type = resp.headers.get("Content-Type", "application/octet-stream")
            atomic_write(path, payload)
            from datetime import datetime, timezone
            write_json(manifest, {
                "schema_version": 1, "source_id": info.source_id,
                "source_url": info.url, "sha256": sha256(payload), "bytes": len(payload),
                "content_type": content_type, "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "reference_period": info.reference_period,
                "license_status": info.license_status,
                "redistribution_allowed": info.redistribution_allowed,
                "stage": "raw", "synthetic": False,
            })
            return path
        except (OSError, urllib.error.URLError, ValueError) as exc:
            error = exc
            if attempt < retries:
                time.sleep(min(2**attempt, 8))
    raise RuntimeError("SOURCE_FETCH_FAILED") from error
