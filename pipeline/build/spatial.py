"""P04 synthetic-only GIS builder; NO Shanghai geometry or public export.

Precomputed intersection areas, never assign statistics to a hex. Only local
fictional metre coordinates are accepted. Real EPSG transforms and boundary
licensing are separate blocked tasks.
"""
from __future__ import annotations

import math
from pathlib import Path

from pipeline.core.geo import (SyntheticLocalProjection, geometries_bounds,
                               intersection_area, polygon_area)
from pipeline.core.hexgrid import HexGrid
from pipeline.core.store import read_json, sha256, write_json


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCENE = PROJECT_ROOT / "tests/fixtures/synthetic/synthetic_gis_scene.json"
MIN_FRACTION = 1e-9
MAX_TOLERANCE = 2e-7


def _assert_synthetic(scene: dict) -> None:
    if not (scene.get("schema_version") == 1 and scene.get("synthetic") is True
            and scene.get("geometry_license_status") == "synthetic"
            and scene.get("canonical_crs") == "SYNTHETIC_LOCAL_METERS"
            and scene.get("raw_crs") == "SYNTHETIC_LOCAL_METERS"):
        raise PermissionError("REAL_GIS_GEOMETRY_NOT_APPROVED")
    if scene.get("disclosure", "").find("FICTIONAL") == -1:
        raise ValueError("SYNTHETIC_DISCLOSURE_REQUIRED")
    SyntheticLocalProjection(scene["canonical_crs"])
    if not isinstance(scene.get("regions"), list) or len(scene["regions"]) < 2:
        raise ValueError("SYNTHETIC_DISTRICT_FEATURES_REQUIRED")
    if not isinstance(scene.get("surfaces"), list) or not scene["surfaces"]:
        raise ValueError("SYNTHETIC_SURFACE_FEATURES_REQUIRED")


def _intersections(scene: dict, grid: HexGrid) -> tuple[dict, dict, dict]:
    cell_area = 3 * math.sqrt(3) * grid.radius_m ** 2 / 2
    district_features = sorted(scene["regions"], key=lambda x: x["id"])
    surface_features = sorted(scene["surfaces"], key=lambda x: x["id"])
    district_ids = [f["id"] for f in district_features]
    if len(set(district_ids)) != len(district_ids):
        raise ValueError("DUPLICATE_SYNTHETIC_DISTRICT_ID")
    if any(f.get("kind") != "district" for f in district_features):
        raise ValueError("INVALID_SYNTHETIC_REGION_KIND")
    if any(f.get("kind") != "water" for f in surface_features):
        raise ValueError("INVALID_SYNTHETIC_SURFACE_KIND")

    district_bboxes = [(f, geometries_bounds(f["geometry"])) for f in district_features]
    water_bboxes = [(f, geometries_bounds(f["geometry"])) for f in surface_features]
    for feature in district_features + surface_features:
        if not polygon_area(feature["geometry"]) > 0:
            raise ValueError("INVALID_SYNTHETIC_AREA")

    # All cells are included, even cells that are only water or unclassified.
    memberships, surfaces, totals = [], [], {
        "district_fraction_total": {d: 0.0 for d in district_ids},
        "water_fraction_total": 0.0, "partial_cells": 0,
        "island_cells": 0, "river_or_coast_cells": 0,
    }

    def overlaps(a: tuple[float, float, float, float],
                 b: tuple[float, float, float, float]) -> bool:
        return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]

    for cell in range(grid.size):
        col, row = grid.col_row(cell)
        vertices = grid.vertices(col, row)
        cell_bbox = grid.cell_bounds(col, row)
        member_fractions: list[tuple[str, float]] = []
        for feature, bbox in district_bboxes:
            if not overlaps(bbox, cell_bbox):
                continue
            frac = intersection_area(feature["geometry"], vertices) / cell_area
            if frac > MIN_FRACTION:
                member_fractions.append((feature["id"], frac))
        water_fracs = [
            intersection_area(feature["geometry"], vertices) / cell_area
            for feature, bbox in water_bboxes if overlaps(bbox, cell_bbox)
        ]
        district_total = math.fsum(frac for _, frac in member_fractions)
        water_total = math.fsum(water_fracs)
        if district_total + water_total > 1 + MAX_TOLERANCE:
            raise ValueError(f"GEOMETRY_PARTITION_OVERLAP:cell={cell}")
        if district_total < -MAX_TOLERANCE or water_total < -MAX_TOLERANCE:
            raise ValueError("NEGATIVE_SPATIAL_COVERAGE")
        if any(frac > 1 + MAX_TOLERANCE for _, frac in member_fractions):
            raise ValueError("REGION_OVER_ONE_CELL")
        for rid, frac in member_fractions:
            memberships.append({"cell_id": cell, "region_id": rid, "fraction": round(frac, 8)})
            totals["district_fraction_total"][rid] += frac

        land = min(1.0, max(0.0, district_total))
        water = min(1.0, max(0.0, water_total))
        outside = max(0.0, 1 - land - water)
        types = sum(f > 1e-7 for f in (land, water, outside))
        partial = types > 1
        if partial:
            totals["partial_cells"] += 1
        if land > MIN_FRACTION and water > MIN_FRACTION:
            totals["river_or_coast_cells"] += 1
        if any(rid == "synthetic-district-b" and row >= 5 for rid, _ in member_fractions):
            totals["island_cells"] += 1
        totals["water_fraction_total"] += water
        surfaces.append({
            "cell_id": cell, "land_fraction": round(land, 8),
            "water_fraction": round(water, 8), "outside_fraction": round(outside, 8),
            "partial_cell": partial,
            "dominant": "land" if land >= max(water, outside) else
                        "water" if water >= outside else "outside",
        })

    world = {
        "schema_version": 1,
        "projection": {"crs": "SYNTHETIC_LOCAL_METERS", "units": "metre",
                       "axis": "x-right-y-down", "origin_x_m": 0, "origin_y_m": 0},
        "grid": scene["grid"],
        "memberships": memberships,
    }
    coverage = {
        "schema_version": 1, "synthetic": True, "publish_approved": False,
        "disclosure": scene["disclosure"], "grid": scene["grid"],
        "cells": surfaces,
        "fixture_source_sha256": sha256(SCENE.read_bytes()),
        "grid_cell_area_m2": round(cell_area, 8),
    }
    summary = {
        "grid_cells": grid.size, "district_feature_count": len(district_features),
        "water_feature_count": len(surface_features),
        "partial_cell_count": totals["partial_cells"],
        "river_or_coast_cell_count": totals["river_or_coast_cells"],
        "island_cell_count": totals["island_cells"],
        "district_area_within_grid_m2": {
            d: round(frac * cell_area, 4) for d, frac in sorted(totals["district_fraction_total"].items())
        },
        "water_area_within_grid_m2": round(totals["water_fraction_total"] * cell_area, 4),
    }
    return world, coverage, summary


def build_synthetic_world(workspace: Path) -> dict:
    """Write deterministic synthetic geometry outputs to workspace/spatial ONLY."""
    scene = read_json(SCENE)
    _assert_synthetic(scene)
    grid = HexGrid.from_contract(scene["grid"])
    world, coverage, summary = _intersections(scene, grid)
    dest = Path(workspace) / "spatial"
    w_hash = write_json(dest / "world.synthetic.json", world)
    c_hash = write_json(dest / "coverage.synthetic.json", coverage)
    manifest = {
        "schema_version": 1, "synthetic": True, "public_map_release_approved": False,
        "p01_g1_status": "BLOCKED", "source_fixture": "tests/fixtures/synthetic/synthetic_gis_scene.json",
        "source_sha256": sha256(SCENE.read_bytes()), "world_sha256": w_hash,
        "coverage_sha256": c_hash, "grid_crs": scene["canonical_crs"],
        "quality": summary,
    }
    write_json(dest / "manifest.synthetic.json", manifest)
    return manifest


def check_synthetic_world(workspace: Path, *, write_report: bool = True) -> dict:
    """Validate SHA chain, P02 world schema semantics and strict per-cell partition."""
    root = Path(workspace)
    errors: list[str] = []
    manifest: dict = {}
    try:
        manifest = read_json(root / "spatial/manifest.synthetic.json")
        world_path = root / "spatial/world.synthetic.json"
        cover_path = root / "spatial/coverage.synthetic.json"
        from pipeline.core.store import read_verified
        read_verified(world_path, manifest["world_sha256"])
        read_verified(cover_path, manifest["coverage_sha256"])
        world = read_json(world_path)
        coverage = read_json(cover_path)
        scene = read_json(SCENE)
        _assert_synthetic(scene)
        if manifest.get("source_sha256") != sha256(SCENE.read_bytes()):
            raise ValueError("SCENE_SHA256_MISMATCH")
        if (manifest.get("synthetic") is not True
                or manifest.get("public_map_release_approved") is not False
                or manifest.get("p01_g1_status") != "BLOCKED"):
            raise PermissionError("SPATIAL_PUBLICATION_GATE_BYPASS")
        if world.get("projection", {}).get("crs") != scene["canonical_crs"]:
            raise ValueError("CRS_MISMATCH")
        grid = HexGrid.from_contract(world["grid"])
        if (len(coverage["cells"]) != grid.size or coverage["synthetic"] is not True
                or coverage.get("publish_approved") is not False
                or coverage.get("grid") != world["grid"]
                or coverage.get("fixture_source_sha256") != manifest["source_sha256"]):
            raise ValueError("SYNTHETIC_COVERAGE_INCONSISTENT")
        expected_districts = {feature["id"] for feature in scene["regions"]}
        membership_by_cell: dict[int, float] = {}
        seen_pair: set[tuple[int, str]] = set()
        for member in world["memberships"]:
            cid, rid, fraction = member["cell_id"], member["region_id"], member["fraction"]
            if (not 0 <= cid < grid.size or not 0 < fraction <= 1 + 1e-7
                    or rid not in expected_districts):
                raise ValueError("INVALID_WORLD_MEMBERSHIP")
            if (cid, rid) in seen_pair:
                raise ValueError("DUPLICATE_WORLD_MEMBERSHIP")
            seen_pair.add((cid, rid))
            membership_by_cell[cid] = membership_by_cell.get(cid, 0.0) + fraction
        seen_cells: set[int] = set()
        for cell in coverage["cells"]:
            cid = cell["cell_id"]
            if not 0 <= cid < grid.size or cid in seen_cells:
                raise ValueError("CELL_ID_OUTSIDE_GRID_OR_DUPLICATE")
            seen_cells.add(cid)
            land, water, outside = (cell["land_fraction"],
                                    cell["water_fraction"], cell["outside_fraction"])
            if (not all(0 <= f <= 1 for f in (land, water, outside))
                    or abs(land + water + outside - 1) > 5e-7):
                raise ValueError("CELL_SURFACE_FRACTIONS_INVALID")
            if abs(land - membership_by_cell.get(cid, 0.0)) > 5e-7:
                raise ValueError("LAND_MEMBERSHIP_MISMATCH")
            expected_partial = sum(f > 1e-7 for f in (land, water, outside)) > 1
            if cell["partial_cell"] != expected_partial:
                raise ValueError("CELL_PARTIAL_FLAG_MISMATCH")
        if len(seen_cells) != grid.size:
            raise ValueError("MISSING_CELL_COVERAGE")
        if manifest.get("quality", {}).get("island_cell_count", 0) < 1:
            raise ValueError("SYNTHETIC_ISLAND_NOT_EXERCISED")
        if manifest.get("quality", {}).get("river_or_coast_cell_count", 0) < 1:
            raise ValueError("SYNTHETIC_WATER_BOUNDARY_NOT_EXERCISED")
    except (OSError, ValueError, KeyError, TypeError, PermissionError) as exc:
        errors.append(f"{type(exc).__name__}:{exc}")
    result = {
        "schema_version": 1,
        "status": "FAIL" if errors else "PASS",
        "mode": "SYNTHETIC_LOCAL_METERS_ONLY",
        "public_map_release_approved": False,
        "p01_g1_status": "BLOCKED",
        "quality": manifest.get("quality", {}),
        "failures": errors,
    }
    if write_report:
        write_json(root / "reports/p04_spatial_quality.json", result)
    return result


def benchmark_grid_sizes(bbox: tuple[float, float, float, float],
                         radii_m: tuple[int, ...] = (500, 1000, 2000)) -> list[dict]:
    """Compare *candidate synthetic grid counts*, not real Shanghai area/error."""
    xmin, ymin, xmax, ymax = bbox
    if not all(math.isfinite(v) for v in bbox) or xmin >= xmax or ymin >= ymax:
        raise ValueError("INVALID_BENCHMARK_BBOX")
    items: list[dict] = []
    for radius in radii_m:
        if radius <= 0:
            raise ValueError("INVALID_BENCHMARK_RADIUS")
        cols = max(1, math.ceil((xmax - xmin) / (math.sqrt(3) * radius)) + 1)
        rows = max(1, math.ceil((ymax - ymin) / (1.5 * radius)) + 1)
        items.append({"radius_m": radius, "cols": cols, "rows": rows,
                      "candidate_cells": cols * rows,
                      "hex_area_m2": round(3 * math.sqrt(3) * radius**2 / 2, 4)})
    return items
