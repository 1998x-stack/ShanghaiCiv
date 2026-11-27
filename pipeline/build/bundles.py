"""Deterministic non-publishable synthetic bundle builds."""
from __future__ import annotations

from pathlib import Path

from pipeline.build.graph import Builder, execute
from pipeline.contracts import validate_bundle
from pipeline.core.store import read_json, read_verified, sha256, write_json
from pipeline.sources.synthetic import registered_sources


def build_bundles(workspace: Path) -> list[str]:
    workspace = Path(workspace)
    out = workspace / "build"
    sources = registered_sources()
    builders: list[Builder] = []

    def make_build(year: str) -> None:
        interim = workspace / "interim" / f"synthetic_{year}.json"
        manifest = read_json(workspace / "interim" / f"synthetic_{year}.manifest.json")
        read_verified(interim, manifest["sha256"])
        data = read_json(interim)
        errors = validate_bundle(data)
        if errors:
            raise ValueError("BUILD_CONTRACT_FAIL:" + ",".join(errors))
        release = data["release"]
        if not release["synthetic"] or release["publish_approved"]:
            raise PermissionError("PRODUCTION_RELEASE_GATE_BLOCKED")
        path = out / f"bundle_{year}.json"
        digest = write_json(path, data)
        write_json(out / f"bundle_{year}.manifest.json", {
            "schema_version": 1, "dataset_id": f"DS-P03-SYN-{year}",
            "source_id": f"SRC-P03-SYN-{year}", "source_sha256": manifest["source_sha256"],
            "interim_sha256": manifest["sha256"], "output_sha256": digest,
            "bytes": path.stat().st_size, "synthetic": True, "publish_approved": False,
        })

    for source in sources:
        year = source.year
        builders.append(Builder(f"bundle_{year}", (f"interim_{year}",), f"bundle_{year}",
                                lambda year=year: make_build(year)))

    def make_index() -> None:
        items = []
        for source in sources:
            year = source.year
            manifest = read_json(out / f"bundle_{year}.manifest.json")
            items.append({"id": f"DS-P03-SYN-{year}", "bundle": f"bundle_{year}.json",
                          "sha256": manifest["output_sha256"], "reference_period": year,
                          "synthetic": True, "publish_approved": False})
        write_json(out / "index.json", {"schema_version": 1, "datasets": items,
                                       "synthetic": True, "publish_approved": False})

    builders.append(Builder("index", tuple(f"bundle_{s.year}" for s in sources), "index", make_index))
    return execute(builders, available={f"interim_{s.year}" for s in sources})
