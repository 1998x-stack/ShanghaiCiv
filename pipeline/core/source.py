"""Minimal source contract and fail-closed rights policy for P03."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SourceInfo:
    source_id: str
    title: str
    url: str
    publisher: str
    reference_period: str
    native_granularity: str
    license_status: str
    redistribution_allowed: bool | None
    synthetic: bool = False

    def assert_access(self, *, public_release: bool = False) -> None:
        if self.synthetic:
            if self.license_status != "synthetic":
                raise PermissionError("SYNTHETIC_SOURCE_LICENSE_INCONSISTENT")
            if public_release:
                raise PermissionError("SYNTHETIC_PUBLIC_RELEASE_FORBIDDEN")
            return
        # An undiscovered, restricted or unknown source is never automatically
        # downloaded or silently promoted to a publishable dataset.
        if self.license_status != "allowed":
            raise PermissionError("SOURCE_LICENSE_NOT_APPROVED")
        if public_release and self.redistribution_allowed is not True:
            raise PermissionError("SOURCE_REDISTRIBUTION_NOT_APPROVED")


class Source(ABC):
    info: SourceInfo

    @abstractmethod
    def fetch(self, workspace: Path, *, offline: bool = True, force: bool = False) -> Path:
        """Acquire/copy raw bytes with a verified provenance manifest."""

    @abstractmethod
    def process(self, workspace: Path) -> Path:
        """Normalize already fetched bytes to the P02 contract."""
