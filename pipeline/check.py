"""Data integrity checks for the P03 research-isolated workspace."""
from __future__ import annotations

from pathlib import Path

from pipeline.contracts import validate_bundle
from pipeline.core.store import read_json, read_verified, sha256, write_json
from pipeline.sources.synthetic import registered_sources


def check_workspace(workspace: Path, *, write_report: bool = True) -> dict:
    root = Path(workspace)
    failures: list[str] = []
    checks: list[dict] = []
    for source in registered_sources():
        yr = source.year
        try:
            raw_m = read_json(source.manifest(root, "raw"))
            raw = read_verified(source.raw(root), raw_m["sha256"])
            if (raw_m["synthetic"] is not True or raw_m["license_status"] != "synthetic"
                    or raw_m["redistribution_allowed"] is not False
                    or raw_m["source_url"] != source.info.url):
                raise ValueError("RAW_RIGHTS_INVALID")
            if sha256(source.fixture.read_bytes()) != sha256(raw):
                raise ValueError("BUNDLED_SOURCE_DRIFT")
            interim_m = read_json(source.manifest(root, "interim"))
            interim = read_verified(source.interim(root), interim_m["sha256"])
            if interim_m["source_sha256"] != raw_m["sha256"]:
                raise ValueError("SOURCE_CHAIN_BROKEN")
            bundle = read_json(source.interim(root))
            errors = validate_bundle(bundle)
            if errors:
                raise ValueError("INTERIM_CONTRACT:" + ",".join(errors))
            final_m = read_json(root / "build" / f"bundle_{yr}.manifest.json")
            final_bytes = read_verified(root / "build" / f"bundle_{yr}.json",
                                        final_m["output_sha256"])
            if final_m["source_sha256"] != raw_m["sha256"] or final_m["interim_sha256"] != interim_m["sha256"]:
                raise ValueError("BUILD_CHAIN_BROKEN")
            final = read_json(root / "build" / f"bundle_{yr}.json")
            if final != bundle or final["release"]["publish_approved"] is not False:
                raise ValueError("PUBLISH_GATE_OR_BUNDLE_MISMATCH")
            if final_m["bytes"] != len(final_bytes):
                raise ValueError("BUNDLE_SIZE_MISMATCH")
            checks.append({"dataset": yr, "status": "PASS",
                           "sha256": final_m["output_sha256"]})
        except (OSError, KeyError, TypeError, ValueError, PermissionError) as exc:
            failures.append(f"{yr}:{type(exc).__name__}:{exc}")
            checks.append({"dataset": yr, "status": "FAIL"})
    try:
        index = read_json(root / "build" / "index.json")
        if (index.get("synthetic") is not True or index.get("publish_approved") is not False
                or len(index["datasets"]) != 2):
            raise ValueError("INDEX_RELEASE_GATE")
        for item in index["datasets"]:
            expected = read_json(root / "build" / f"bundle_{item['reference_period']}.manifest.json")
            if item["sha256"] != expected["output_sha256"] or item["publish_approved"] is not False:
                raise ValueError("INDEX_SHA256_MISMATCH")
    except (OSError, KeyError, TypeError, ValueError) as exc:
        failures.append(f"index:{type(exc).__name__}:{exc}")
    if (root / "web" / "data").exists():
        failures.append("UNEXPECTED_PUBLIC_DATA_OUTPUT")
    result = {"schema_version": 1, "status": "FAIL" if failures else "PASS",
              "mode": "synthetic_only", "public_map_release_approved": False,
              "p01_g1_status": "BLOCKED",
              "checks": checks, "failures": sorted(failures),
              "notes": ["2024 industrial total mismatch of 1717.14 (100m CNY) in P01 research remains unresolved.",
                        "This test suite does not evaluate actual maps, government approvals or rights."]}
    if write_report:
        write_json(root / "reports" / "p03_quality.json", result)
    return result
