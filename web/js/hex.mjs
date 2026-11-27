// Browser mirror of pipeline/core/hexgrid.py.
// metres, x right, y down, pointy top, odd-r. Shared-fixture tests guard drift.
const SQRT3 = Math.sqrt(3);
const NEIGHBORS = [
  [[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]],
  [[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]],
];

export class HexGrid {
  constructor({radius_m, cols, rows, origin_x_m = 0, origin_y_m = 0}) {
    if (!Number.isFinite(radius_m) || radius_m <= 0 ||
        !Number.isSafeInteger(cols) || cols <= 0 ||
        !Number.isSafeInteger(rows) || rows <= 0 ||
        !Number.isFinite(origin_x_m) || !Number.isFinite(origin_y_m)) {
      throw new RangeError("invalid hex grid contract");
    }
    Object.assign(this, {radius_m, cols, rows, origin_x_m, origin_y_m});
  }

  get size() { return this.cols * this.rows; }

  index(col, row) {
    if (!Number.isInteger(col) || !Number.isInteger(row) ||
        col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      throw new RangeError("hex col/row outside grid");
    }
    return row * this.cols + col;
  }

  colRow(cellId) {
    if (!Number.isSafeInteger(cellId) || cellId < 0 || cellId >= this.size) {
      throw new RangeError("hex cell ID outside grid");
    }
    return [cellId % this.cols, Math.floor(cellId / this.cols)];
  }

  center(col, row) {
    this.index(col, row);
    return [
      this.origin_x_m + SQRT3 * this.radius_m * (col + 0.5 * (row & 1)),
      this.origin_y_m + 1.5 * this.radius_m * row,
    ];
  }

  cellAt(xm, ym) {
    if (!Number.isFinite(xm) || !Number.isFinite(ym)) return -1;
    const x = xm - this.origin_x_m, y = ym - this.origin_y_m;
    const q = (SQRT3 / 3 * x - y / 3) / this.radius_m;
    const r = (2 / 3 * y) / this.radius_m;
    const cx = q, cz = r, cy = -cx - cz;
    let rx = Math.floor(cx + 0.5), ry = Math.floor(cy + 0.5), rz = Math.floor(cz + 0.5);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy <= dz) rz = -rx - ry;
    const row = rz;
    const col = rx + (row - (row & 1)) / 2;
    return (col >= 0 && col < this.cols && row >= 0 && row < this.rows)
      ? row * this.cols + col : -1;
  }

  neighbors(cellId) {
    const [col,row] = this.colRow(cellId);
    return NEIGHBORS[row & 1].flatMap(([dc,dr]) => {
      const c = col + dc, r = row + dr;
      return (c >= 0 && c < this.cols && r >= 0 && r < this.rows) ? [this.index(c,r)] : [];
    });
  }
}
