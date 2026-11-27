"""P04 GIS foundation: local synthetic coordinates and polygon/hex overlays.

Only planar XY metres. No real CRS transformation, Shanghai boundaries or
licensed geodata is supplied. All geometry is synthetic test geometry.

Geometry accepts Polygon/MultiPolygon coordinates with interior holes.
Input rings must be simple, disjoint shells; a production GIS backend will
need robust validity/topology checks before accepting real-world geometries.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Sequence

Point = tuple[float, float]
Ring = tuple[Point, ...]
EPSILON = 1e-9


@dataclass(frozen=True)
class SyntheticLocalProjection:
    """Affine offset only, explicitly not an EPSG or datum transformation."""

    crs: str = "SYNTHETIC_LOCAL_METERS"
    origin_x_m: float = 0.0
    origin_y_m: float = 0.0

    def __post_init__(self) -> None:
        if self.crs != "SYNTHETIC_LOCAL_METERS":
            raise PermissionError("REAL_CRS_TRANSFORM_NOT_IMPLEMENTED")
        if not all(math.isfinite(v) for v in (self.origin_x_m, self.origin_y_m)):
            raise ValueError("NONFINITE_PROJECTION_ORIGIN")

    def forward(self, x: float, y: float) -> Point:
        if not all(math.isfinite(v) for v in (x, y)):
            raise ValueError("NONFINITE_COORDINATE")
        return x - self.origin_x_m, y - self.origin_y_m

    def inverse(self, x: float, y: float) -> Point:
        if not all(math.isfinite(v) for v in (x, y)):
            raise ValueError("NONFINITE_COORDINATE")
        return x + self.origin_x_m, y + self.origin_y_m


def ring(points: Sequence[Sequence[float]]) -> Ring:
    if not isinstance(points, (list, tuple)) or len(points) < 3:
        raise ValueError("INVALID_RING_TOO_FEW_POINTS")
    result: list[Point] = []
    for point in points:
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError("INVALID_RING_VERTEX")
        x, y = point
        if not isinstance(x, (float, int)) or isinstance(x, bool) or not math.isfinite(x):
            raise ValueError("NONFINITE_RING_VERTEX")
        if not isinstance(y, (float, int)) or isinstance(y, bool) or not math.isfinite(y):
            raise ValueError("NONFINITE_RING_VERTEX")
        result.append((float(x), float(y)))
    if result[0] == result[-1]:
        result.pop()
    if len(result) < 3 or len(set(result)) < 3:
        raise ValueError("INVALID_RING_TOO_FEW_UNIQUE_VERTICES")
    if abs(signed_area(result)) <= EPSILON:
        raise ValueError("ZERO_AREA_RING")
    return tuple(result)


def signed_area(points: Sequence[Point]) -> float:
    return 0.5 * sum(points[i][0] * points[(i + 1) % len(points)][1]
                     - points[(i + 1) % len(points)][0] * points[i][1]
                     for i in range(len(points))) if len(points) >= 3 else 0.0


def polygon_area(geometry: dict) -> float:
    total = 0.0
    for polygon in _polygons(geometry):
        shell = abs(signed_area(ring(polygon[0])))
        holes = sum(abs(signed_area(ring(h))) for h in polygon[1:])
        if holes > shell + EPSILON:
            raise ValueError("HOLES_EXCEED_SHELL")
        total += shell - holes
    return total


def _polygons(geometry: dict) -> list[list[list[list[float]]]]:
    if not isinstance(geometry, dict):
        raise ValueError("GEOMETRY_OBJECT_REQUIRED")
    typ = geometry.get("type")
    coords = geometry.get("coordinates")
    if typ == "Polygon":
        polys = [coords]
    elif typ == "MultiPolygon":
        polys = coords
    else:
        raise ValueError("UNSUPPORTED_GEOMETRY_TYPE")
    if not isinstance(polys, list) or not polys:
        raise ValueError("EMPTY_POLYGON")
    for poly in polys:
        if not isinstance(poly, list) or not poly:
            raise ValueError("EMPTY_POLYGON_SHELL")
        for item in poly:
            ring(item)
    return polys


def bounds(points: Sequence[Point]) -> tuple[float, float, float, float]:
    if not points:
        raise ValueError("EMPTY_BOUNDS")
    return min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)


def geometries_bounds(geometry: dict) -> tuple[float, float, float, float]:
    all_points = [p for poly in _polygons(geometry) for r in poly for p in ring(r)]
    return bounds(all_points)


def boxes_overlap(a: tuple[float, float, float, float],
                  b: tuple[float, float, float, float]) -> bool:
    return a[0] < b[2] + EPSILON and b[0] < a[2] + EPSILON and a[1] < b[3] + EPSILON and b[1] < a[3] + EPSILON


def _cross(a: Point, b: Point, p: Point) -> float:
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def clip_to_convex_polygon(subject: Sequence[Point], clipper: Sequence[Point]) -> Ring:
    """Sutherland-Hodgman clipping by convex polygon; area-preserving for simple rings."""
    if len(clipper) < 3:
        raise ValueError("CLIPPER_TOO_SMALL")
    orient = 1 if signed_area(clipper) > 0 else -1
    output = list(subject)
    for i, a in enumerate(clipper):
        b = clipper[(i + 1) % len(clipper)]
        inp, output = output, []
        if not inp:
            break
        last = inp[-1]
        last_d = orient * _cross(a, b, last)
        for current in inp:
            current_d = orient * _cross(a, b, current)
            last_inside = last_d >= -EPSILON
            current_inside = current_d >= -EPSILON
            if current_inside != last_inside:
                den = last_d - current_d
                if abs(den) > EPSILON:
                    t = max(0.0, min(1.0, last_d / den))
                    output.append((last[0] + t * (current[0] - last[0]),
                                   last[1] + t * (current[1] - last[1])))
            if current_inside:
                output.append(current)
            last, last_d = current, current_d
    return tuple(output)


def intersection_area(geometry: dict, clipper: Sequence[Point]) -> float:
    """Area of Polygon/MultiPolygon with holes intersected by a convex hex.

    Prerequisite: rings are simple, holes are inside shells and polygon shells
    do not overlap. P04 synthetic builder asserts physically valid partition.
    """
    if len(clipper) < 3:
        return 0.0
    bbox = bounds(clipper)
    total = 0.0
    for polygon in _polygons(geometry):
        shell = ring(polygon[0])
        if not boxes_overlap(bounds(shell), bbox):
            continue
        shell_area = abs(signed_area(clip_to_convex_polygon(shell, clipper)))
        holes_area = sum(abs(signed_area(clip_to_convex_polygon(ring(hole), clipper)))
                         for hole in polygon[1:])
        area = shell_area - holes_area
        if area < -1e-5:
            raise ValueError("INTERSECTION_HOLES_EXCEED_SHELL")
        total += max(0.0, area)
    return total
