#!/usr/bin/env python3
"""CLI for one or more P02 contract bundles; no external dependencies."""
from __future__ import annotations
import json
import sys
from pathlib import Path

from pipeline.contracts import validate_bundle

DEFAULTS = sorted(Path("tests/fixtures/synthetic").glob("synthetic_20*.json"))


def main(argv: list[str]) -> int:
    files = [Path(x) for x in argv] if argv else DEFAULTS
    if not files:
        print("No fixtures selected", file=sys.stderr)
        return 2
    failed = False
    for path in files:
        try:
            errors = validate_bundle(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as exc:
            print(json.dumps({"file": path.name, "errors": ["INPUT_INVALID"], "detail": str(exc)}, ensure_ascii=False))
            failed = True
            continue
        print(json.dumps({"file": path.name, "errors": errors}, ensure_ascii=False, sort_keys=True))
        failed |= bool(errors)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
