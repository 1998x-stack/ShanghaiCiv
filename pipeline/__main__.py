"""P03 CLI: synthetic-only, deterministic, fail-closed ETL.

Examples:
 python -m pipeline list
 python -m pipeline all --offline --workspace .p03-work
 python -m pipeline check --workspace .p03-work
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pipeline.build.bundles import build_bundles
from pipeline.check import check_workspace
from pipeline.sources.synthetic import registered_sources


def run(command: str, *, workspace: Path, offline: bool = True,
        force: bool = False) -> dict:
    sources = registered_sources()
    if command == "list":
        return {"status": "PASS", "sources": [
            {"source_id": s.info.source_id, "reference_period": s.year,
             "license_status": s.info.license_status, "synthetic": True,
             "publish_approved": False} for s in sources]}
    if command in ("fetch", "all"):
        for source in sources:
            source.fetch(workspace, offline=offline, force=force)
    if command in ("process", "all"):
        for source in sources:
            source.process(workspace)
    if command in ("build", "all"):
        build_bundles(workspace)
    if command in ("check", "all"):
        return check_workspace(workspace)
    return {"status": "PASS", "command": command,
            "workspace": str(workspace), "synthetic": True,
            "public_map_release_approved": False}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ShanghaiCiv source-to-static-data pipeline")
    parser.add_argument("command", choices=["list", "fetch", "process", "build", "check", "all"])
    parser.add_argument("--workspace", type=Path, default=Path(".p03-work"),
                        help="Isolated raw/interim/build/reports working directory")
    parser.add_argument("--offline", action="store_true", default=True,
                        help="Explicitly require offline operation (default)")
    parser.add_argument("--force", action="store_true", help="Refresh local fixture cache")
    args = parser.parse_args(argv)
    try:
        result = run(args.command, workspace=args.workspace, offline=args.offline, force=args.force)
    except (OSError, ValueError, PermissionError, KeyError, TypeError) as exc:
        print(json.dumps({"status": "FAIL", "error": type(exc).__name__,
                          "detail": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return int(result.get("status") == "FAIL")


if __name__ == "__main__":
    sys.exit(main())
