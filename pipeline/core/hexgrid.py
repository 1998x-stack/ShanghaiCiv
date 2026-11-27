"""Dependency-free pointy-top hex coordinates (odd-r offset, synthetic-safe).

Contract: map coordinates in metres, origin on top-left, x right and y down.
The browser mirror is web/js/hex.mjs; both are tested against shared fixtures.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

_SQRT3 = math.sqrt(3)
_NEIGHBOURS = (
    ((1, 0), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1)),
    ((1, 0), (1, 1), (0, 1), (-1, 0), (0, -1), (1, -1)),
)


@dataclass(frozen=True)
class HexGrid:
    radius_m: float
    cols: int
    rows: int
    origin_x_m: float = 0.0
    origin_y_m: float = 0.0

    def __post_init__(self) -> None:
        if not math.isfinite(self.radius_m) or self.radius_m <= 0:
            raise ValueError("radius_m must be finite and positive")
        if self.cols <= 0 or self.rows <= 0:
            raise ValueError("cols and rows must be positive integers")

    @property
    def size(self) -> int:
        return self.cols * self.rows

    def index(self, col: int, row: int) -> int:
        if not (0 <= col < self.cols and 0 <= row < self.rows):
            raise IndexError((col, row))
        return row * self.cols + col

    def col_row(self, index: int) -> tuple[int, int]:
        if not (0 <= index < self.size):
            raise IndexError(index)
        return index % self.cols, index // self.cols

    def center(self, col: int, row: int) -> tuple[float, float]:
        self.index(col, row)
        return (self.origin_x_m + _SQRT3 * self.radius_m * (col + 0.5 * (row & 1)),
                self.origin_y_m + 1.5 * self.radius_m * row)

    def cell_at(self, x_m: float, y_m: float) -> int:
        """Nearest hex centre for a point, or -1 for out of grid.

        The nearest-centre rule is used for hit testing. It never assigns a
        legal administrative boundary or interpolates statistical data.
        """
        if not (math.isfinite(x_m) and math.isfinite(y_m)):
            return -1
        x = x_m - self.origin_x_m
        y = y_m - self.origin_y_m
        q = (_SQRT3 / 3 * x - y / 3) / self.radius_m
        r = (2 / 3 * y) / self.radius_m
        cx, cz = q, r
        cy = -cx - cz
        rx, ry, rz = math.floor(cx + 0.5), math.floor(cy + 0.5), math.floor(cz + 0.5)
        dx, dy, dz = abs(rx - cx), abs(ry - cy), abs(rz - cz)
        if dx > dy and dx > dz:
            rx = -ry - rz
        elif dy <= dz:
            rz = -rx - ry
        row = rz
        col = rx + (row - (row & 1)) // 2
        return row * self.cols + col if 0 <= col < self.cols and 0 <= row < self.rows else -1

    def neighbors(self, cell_id: int) -> list[int]:
        col, row = self.col_row(cell_id)
        out = []
        for dc, dr in _NEIGHBOURS[row & 1]:
            c, r = col + dc, row + dr
            if 0 <= c < self.cols and 0 <= r < self.rows:
                out.append(self.index(c, r))
        return out

    @classmethod
    def from_contract(cls, grid: dict) -> "HexGrid":
        return cls(radius_m=grid["radius_m"], cols=grid["cols"], rows=grid["rows"],
                   origin_x_m=grid["origin_x_m"], origin_y_m=grid["origin_y_m"])
