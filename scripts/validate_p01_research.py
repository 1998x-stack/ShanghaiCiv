#!/usr/bin/env python3
"""Validate the P01 research-only Shanghai district snapshot.

No third-party downloads or GIS data are loaded. This is a reproducible
consistency check, NOT a production publication approval or source-license check.
Run: python scripts/validate_p01_research.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/research/districts_2024_observations.json"
CITY_TOTALS = {
    "area_km2": (6340.50, 0.01),
    "resident_population_10k": (2480.26, 0.01),
    "non_local_resident_population_10k": (983.49, 0.01),
    "industrial_enterprise_gross_output_100m_cny": (39651.73, None),
    "above_scale_service_enterprise_revenue_100m_cny": (59953.90, 0.05),
    "green_area_ha": (174064.21, 0.05),
    "urban_park_count": (512, 0),
}

def main() -> int:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []
    rows = data.get("districts", [])
    if data.get("status") != "RESEARCH_ONLY_NOT_PUBLISH_APPROVED":
        errors.append("Publication status must remain RESEARCH_ONLY_NOT_PUBLISH_APPROVED.")
    if len(rows) != 16:
        errors.append(f"Expected 16 district rows; got {len(rows)}.")
    ids = [r.get("district_code") for r in rows]
    if len(set(ids)) != 16 or any(not isinstance(i, str) or len(i) != 6 for i in ids):
        errors.append("District codes must be 16 distinct six-character strings.")
    if len({r.get("name") for r in rows}) != 16:
        errors.append("District names must be distinct.")
    for i, row in enumerate(rows):
        if not row.get("name"):
            errors.append(f"Missing name in row {i}")
        for key in CITY_TOTALS:
            value = row.get(key)
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
                errors.append(f"{row.get('name', i)}.{key}: missing/non-numeric")
            elif value < 0:
                errors.append(f"{row.get('name', i)}.{key}: negative")
        p, immigrant, area, density = (
            row.get("resident_population_10k"),
            row.get("non_local_resident_population_10k"),
            row.get("area_km2"),
            row.get("resident_population_density_per_km2"),
        )
        if all(isinstance(v, (int, float)) for v in (p, immigrant, area, density)):
            if area <= 0:
                errors.append(f"{row['name']}: non-positive area")
            if immigrant > p:
                errors.append(f"{row['name']}: non-local resident count exceeds total")
            if area > 0 and abs((p * 10000 / area) - density) > 12:
                errors.append(f"{row['name']}: density inconsistency beyond rounded source precision")

    for key, (expected, tol) in CITY_TOTALS.items():
        if any(not isinstance(row.get(key), (int, float)) for row in rows):
            continue
        actual = round(sum(row[key] for row in rows), 2)
        diff = round(actual - expected, 2)
        if tol is None:
            if abs(diff) > 0.01:
                warnings.append(
                    f"{key}: district sum={actual}, city total={expected}, "
                    f"unreconciled difference={diff}; do NOT automatically aggregate"
                )
        elif abs(diff) > tol + 1e-9:
            errors.append(
                f"{key}: district sum={actual}, city total={expected}, "
                f"difference={diff} outside tolerance={tol}"
            )

    # The district and city total mismatch is a known anomaly, not a reason to
    # fabricate missing district data. Keep an explicit human review flag.
    caveats = " ".join(data.get("known_limitations", []))
    if "1717.14" not in caveats:
        errors.append("Industrial 1717.14 CNY 100M mismatch caveat is missing.")
    for e in errors:
        print("FAIL", e)
    for w in warnings:
        print("WARN", w)
    print(f"District rows: {len(rows)}; checked city-total fields: {len(CITY_TOTALS)}")
    print(f"Validation: {'FAIL' if errors else 'PASS_WITH_WARN' if warnings else 'PASS'}")
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
