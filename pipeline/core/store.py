"""Deterministic serialization, SHA256 provenance and crash-safe atomic writes."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                       allow_nan=False) + "\n").encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: bytes) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".tmp-", delete=False) as handle:
            name = handle.name
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if name is not None and os.path.exists(name):
            os.unlink(name)


def read_verified(path: Path, expected_sha256: str) -> bytes:
    data = Path(path).read_bytes()
    if sha256(data) != expected_sha256:
        raise ValueError(f"SHA256_MISMATCH: {path.name}")
    return data


def write_json(path: Path, obj: Any) -> str:
    data = canonical_json(obj)
    atomic_write(Path(path), data)
    return sha256(data)


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))
