"""Bundled, invented two-year fixtures; they are not Shanghai observations."""
from __future__ import annotations

from pathlib import Path

from pipeline.contracts import validate_bundle
from pipeline.core.source import Source, SourceInfo
from pipeline.core.store import atomic_write, canonical_json, read_json, read_verified, sha256, write_json

PROJECT_ROOT = Path(__file__).resolve().parents[2]
VALID_YEARS = ("2024", "2025")


class FixtureSource(Source):
    def __init__(self, year: str):
        if year not in VALID_YEARS:
            raise ValueError("UNKNOWN_SYNTHETIC_VINTAGE")
        self.year = year
        self.fixture = PROJECT_ROOT / "tests" / "fixtures" / "synthetic" / f"synthetic_{year}.json"
        self.info = SourceInfo(
            source_id=f"SRC-P03-SYN-{year}", title=f"Fictional ShanghaiCiv fixture {year}",
            url=f"fixture://tests/fixtures/synthetic/synthetic_{year}.json",
            publisher="ShanghaiCiv test suite", reference_period=year,
            native_granularity="district", license_status="synthetic",
            redistribution_allowed=False, synthetic=True,
        )

    @property
    def filename(self) -> str:
        return f"synthetic_{self.year}.json"

    def raw(self, workspace: Path) -> Path:
        return Path(workspace) / "raw" / self.filename

    def interim(self, workspace: Path) -> Path:
        return Path(workspace) / "interim" / self.filename

    def manifest(self, workspace: Path, stage: str) -> Path:
        return Path(workspace) / stage / f"synthetic_{self.year}.manifest.json"

    def fetch(self, workspace: Path, *, offline: bool = True, force: bool = False) -> Path:
        self.info.assert_access()
        if not offline:
            # This adapter always takes bytes from local synthetic fixtures.
            raise PermissionError("SYNTHETIC_FIXTURE_NETWORK_MODE_FORBIDDEN")
        source_bytes = self.fixture.read_bytes()
        source_sha = sha256(source_bytes)
        dest, manifest_path = self.raw(workspace), self.manifest(workspace, "raw")
        if (dest.exists() or manifest_path.exists()) and not force:
            if not (dest.exists() and manifest_path.exists()):
                raise ValueError("PARTIAL_CACHE")
            m = read_json(manifest_path)
            read_verified(dest, m.get("sha256", ""))
            if source_sha != m.get("sha256"):
                raise ValueError("CACHE_OUTDATED_REQUIRE_FORCE")
            return dest
        atomic_write(dest, source_bytes)
        write_json(manifest_path, {
            "schema_version": 1, "source_id": self.info.source_id,
            "source_url": self.info.url, "reference_period": self.year,
            "sha256": source_sha, "bytes": len(source_bytes),
            "retrieved_at": None, "retrieval_mode": "bundled_synthetic_fixture",
            "license_status": "synthetic", "redistribution_allowed": False,
            "native_granularity": "district", "stage": "raw", "synthetic": True,
        })
        return dest

    def process(self, workspace: Path) -> Path:
        self.info.assert_access()
        raw, raw_manifest = self.raw(workspace), self.manifest(workspace, "raw")
        manifest = read_json(raw_manifest)
        raw_bytes = read_verified(raw, manifest["sha256"])
        import json
        bundle = json.loads(raw_bytes)
        problems = validate_bundle(bundle)
        if problems:
            raise ValueError("CONTRACT_FAIL:" + ",".join(problems))
        if bundle["release"]["data_vintage"] != self.year:
            raise ValueError("DATA_VINTAGE_MISMATCH")
        data = canonical_json(bundle)
        dest = self.interim(workspace)
        atomic_write(dest, data)
        write_json(self.manifest(workspace, "interim"), {
            "schema_version": 1, "source_id": self.info.source_id, "dataset_id": f"DS-P03-SYN-{self.year}",
            "reference_period": self.year, "revision_stage": "synthetic",
            "native_granularity": "district", "license_status": "synthetic",
            "redistribution_allowed": False, "stage": "interim", "synthetic": True,
            "source_sha256": manifest["sha256"], "sha256": sha256(data), "bytes": len(data),
            "method": "canonical_json+P02_semantic_validation",
        })
        return dest


def registered_sources() -> list[FixtureSource]:
    return [FixtureSource(year) for year in VALID_YEARS]
