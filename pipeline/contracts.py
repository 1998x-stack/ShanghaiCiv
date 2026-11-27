"""ShanghaiCiv contract-v1 semantic checks; Python stdlib only.

Formal shape is documented in schemas/*.schema.json. This module enforces
cross-record relationships and fail-closed data semantics that JSON Schema
cannot infer. It DOES NOT grant map or statistics redistribution permissions.
"""
from __future__ import annotations

import math
import re
from collections import defaultdict

KINDS = {"municipality", "district", "zone", "hex_cell", "facility"}
STATUSES = {"observed", "derived", "estimated", "unavailable"}
PERIOD = re.compile(r"^\d{4}(?:-\d{2}(?:-\d{2})?)?$")


def _string(v: object) -> bool:
    return isinstance(v, str) and bool(v.strip())


def _number(v: object) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _id(v: object) -> bool:
    return _string(v) and not any(c.isspace() for c in v)


def comparable(a: dict, b: dict) -> bool:
    """True only for values comparable as one rank/series without extra metadata.

    Derived/estimated may be shown separately but never silently mixed with
    observed or unavailable values.
    """
    keys = ("metric_id", "unit", "period", "granularity", "status")
    return (isinstance(a, dict) and isinstance(b, dict)
            and a.get("status") != "unavailable"
            and all(a.get(k) == b.get(k) for k in keys)
            and _number(a.get("value")) and _number(b.get("value")))


def validate_bundle(bundle: object) -> list[str]:
    errors: set[str] = set()

    def bad(code: str) -> None:
        errors.add(code)

    if not isinstance(bundle, dict):
        return ["BUNDLE_STRUCTURE"]
    if bundle.get("schema_version") != 1:
        bad("SCHEMA_VERSION")
    release = bundle.get("release")
    if not isinstance(release, dict):
        bad("RELEASE_FIELDS")
        release = {}
    if (release.get("schema_version") != 1
            or not _string(release.get("build_id"))
            or not _string(release.get("data_vintage"))
            or not isinstance(release.get("synthetic"), bool)
            or not isinstance(release.get("publish_approved"), bool)
            or release.get("license_review") not in {"blocked", "approved"}):
        bad("RELEASE_FIELDS")
    synthetic = release.get("synthetic") is True
    publishing = release.get("publish_approved") is True
    if synthetic and publishing:
        bad("RELEASE_SYNTHETIC_PUBLISH")
    if publishing and release.get("license_review") != "approved":
        bad("RELEASE_LICENSE_NOT_APPROVED")

    groups = {}
    for key in ("sources", "regions", "metrics", "lenses"):
        v = bundle.get(key)
        if not isinstance(v, list):
            bad("BUNDLE_STRUCTURE")
            v = []
        groups[key] = v
    sources, regions, metrics, lenses = (groups[k] for k in ("sources", "regions", "metrics", "lenses"))
    smap, rmap = {}, {}
    for s in sources:
        if not isinstance(s, dict):
            bad("SOURCE_FIELDS")
            continue
        sid = s.get("id")
        if (not _id(sid) or not _string(s.get("publisher"))
                or not _string(s.get("title")) or not _string(s.get("url"))
                or s.get("native_granularity") not in KINDS
                or s.get("license_status") not in {"unknown", "allowed", "restricted", "prohibited", "synthetic"}
                or (s.get("redistribution_allowed") is not None
                    and not isinstance(s.get("redistribution_allowed"), bool))):
            bad("SOURCE_FIELDS")
        if sid in smap:
            bad("SOURCE_DUPLICATE")
        if isinstance(sid, str):
            smap[sid] = s
        if synthetic and s.get("license_status") != "synthetic":
            bad("SYNTHETIC_REAL_SOURCE_MIX")
        if not synthetic and s.get("license_status") == "synthetic":
            bad("SYNTHETIC_REAL_SOURCE_MIX")
        if publishing and (s.get("license_status") != "allowed"
                           or s.get("redistribution_allowed") is not True):
            bad("SOURCE_RELEASE")

    for r in regions:
        if not isinstance(r, dict):
            bad("REGION_FIELDS")
            continue
        rid = r.get("id")
        if (not _id(rid) or not _string(r.get("name_zh"))
                or r.get("kind") not in KINDS
                or not (r.get("parent_id") is None or _id(r.get("parent_id")))
                or not (r.get("code") is None or _string(r.get("code")))
                or not (r.get("geometry_ref") is None or _string(r.get("geometry_ref")))):
            bad("REGION_FIELDS")
        if rid in rmap:
            bad("REGION_DUPLICATE")
        if isinstance(rid, str):
            rmap[rid] = r
    for r in regions:
        if not isinstance(r, dict):
            continue
        parent = r.get("parent_id")
        if parent is not None and parent not in rmap:
            bad("REGION_PARENT")
        seen = set()
        curr = r
        while isinstance(curr, dict):
            rid = curr.get("id")
            if rid in seen:
                bad("REGION_CYCLE")
                break
            seen.add(rid)
            pid = curr.get("parent_id")
            curr = rmap.get(pid) if isinstance(pid, str) else None

    world = bundle.get("world")
    if not isinstance(world, dict):
        bad("WORLD_FIELDS")
        world = {}
    grid, proj = world.get("grid"), world.get("projection")
    if not isinstance(grid, dict):
        grid = {}
    if not isinstance(proj, dict):
        proj = {}
    if world.get("schema_version") != 1:
        bad("WORLD_FIELDS")
    if (grid.get("layout") != "odd-r" or grid.get("orientation") != "pointy"
            or not _number(grid.get("radius_m")) or not grid.get("radius_m", 0) > 0
            or not isinstance(grid.get("cols"), int) or isinstance(grid.get("cols"), bool)
            or not isinstance(grid.get("rows"), int) or isinstance(grid.get("rows"), bool)
            or grid.get("cols", 0) <= 0 or grid.get("rows", 0) <= 0
            or not _number(grid.get("origin_x_m")) or not _number(grid.get("origin_y_m"))):
        bad("GRID_INVALID")
    if (not _string(proj.get("crs")) or proj.get("units") != "metre"
            or proj.get("axis") != "x-right-y-down"
            or not _number(proj.get("origin_x_m"))
            or not _number(proj.get("origin_y_m"))):
        bad("GRID_PROJECTION")
    if synthetic and isinstance(proj.get("crs"), str) and not proj["crs"].startswith("SYNTHETIC_"):
        bad("SYNTHETIC_REAL_CRS_MIX")
    size = (grid.get("cols", 0) * grid.get("rows", 0)
            if isinstance(grid.get("cols"), int) and not isinstance(grid.get("cols"), bool)
            and isinstance(grid.get("rows"), int) and not isinstance(grid.get("rows"), bool) else 0)
    memberships = world.get("memberships")
    if not isinstance(memberships, list):
        bad("WORLD_FIELDS")
        memberships = []
    weight_by_cell: dict[int, float] = defaultdict(float)
    pairs = set()
    for m in memberships:
        if not isinstance(m, dict):
            bad("MEMBERSHIP_INVALID")
            continue
        cid, rid, fraction = m.get("cell_id"), m.get("region_id"), m.get("fraction")
        if (not isinstance(cid, int) or isinstance(cid, bool) or not 0 <= cid < size
                or not _number(fraction) or not 0 < fraction <= 1):
            bad("MEMBERSHIP_INVALID")
            continue
        if not _id(rid) or rid not in rmap or rmap[rid].get("kind") != "district":
            bad("MEMBERSHIP_REGION")
            continue
        if (cid, rid) in pairs:
            bad("MEMBERSHIP_DUPLICATE")
        pairs.add((cid, rid))
        weight_by_cell[cid] += fraction
    if any(w > 1.000001 for w in weight_by_cell.values()):
        bad("MEMBERSHIP_SUM")

    seen_metrics = set()
    for m in metrics:
        if not isinstance(m, dict):
            bad("METRIC_FIELDS")
            continue
        mid, rid, gran = m.get("metric_id"), m.get("geography_id"), m.get("granularity")
        status, val, sid = m.get("status"), m.get("value"), m.get("source_id")
        flags = m.get("quality_flags")
        if (not _id(mid) or not _id(rid) or gran not in KINDS or not _string(m.get("unit"))
                or not _string(m.get("period")) or status not in STATUSES
                or not _id(sid) or not (m.get("method_id") is None or _id(m.get("method_id")))
                or not isinstance(flags, list) or any(not _string(x) for x in flags)
                or (isinstance(flags, list) and len(flags) != len(set(str(x) for x in flags)))):
            bad("METRIC_FIELDS")
        if not isinstance(m.get("period"), str) or not PERIOD.fullmatch(m.get("period")):
            bad("METRIC_PERIOD")
        key = (mid, rid, m.get("period"))
        if key in seen_metrics:
            bad("METRIC_DUPLICATE")
        seen_metrics.add(key)
        if status == "unavailable":
            if val is not None:
                bad("METRIC_STATUS_VALUE")
        elif not _number(val):
            bad("METRIC_STATUS_VALUE")
        if status in ("derived", "estimated") and not _id(m.get("method_id")):
            bad("METRIC_DERIVATION")
        if status == "observed" and m.get("method_id") is not None:
            bad("METRIC_DERIVATION")
        if rid not in rmap or rmap[rid].get("kind") != gran:
            if gran == "hex_cell" and isinstance(rid, str) and re.fullmatch(r"hex:\d+", rid):
                cell = int(rid.split(":")[1])
                if not 0 <= cell < size:
                    bad("METRIC_GEO_REF")
                if status == "observed" and (not isinstance(flags, list)
                                              or "direct_spatial_observation" not in flags):
                    bad("METRIC_HEX_OBSERVATION")
            else:
                bad("METRIC_GEO_REF")
        if sid not in smap:
            bad("METRIC_SOURCE_REF")
        elif status == "observed" and smap[sid].get("native_granularity") != gran:
            bad("METRIC_NATIVE_GRANULARITY")
        if status == "estimated" and (not isinstance(flags, list) or "modeled" not in flags):
            bad("METRIC_ESTIMATE_FLAG")

    metric_by_id: dict[str, set[str]] = defaultdict(set)
    for m in metrics:
        if isinstance(m, dict) and isinstance(m.get("metric_id"), str):
            metric_by_id[m["metric_id"]].add(m.get("granularity"))
    seen_lenses = set()
    for l in lenses:
        if not isinstance(l, dict):
            bad("LENS_FIELDS")
            continue
        lid = l.get("id")
        if (not _id(lid) or not _string(l.get("title")) or not _id(l.get("metric_id"))
                or l.get("granularity") not in KINDS
                or l.get("scale") not in {"linear", "log", "quantile", "category"}):
            bad("LENS_FIELDS")
        if lid in seen_lenses:
            bad("LENS_DUPLICATE")
        seen_lenses.add(lid)
        if l.get("metric_id") not in metric_by_id:
            bad("LENS_METRIC_REF")
        elif l.get("granularity") not in metric_by_id[l["metric_id"]]:
            bad("LENS_GRANULARITY")

    return sorted(errors)
