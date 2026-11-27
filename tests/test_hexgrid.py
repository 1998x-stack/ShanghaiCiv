"""Odd-r index and neighbour consistency on an entirely synthetic local grid."""
from __future__ import annotations
import json
import math
import shutil
import subprocess
import unittest
from pathlib import Path
from pipeline.core.hexgrid import HexGrid

ROOT = Path(__file__).resolve().parents[1]


class TestHexGrid(unittest.TestCase):
    def setUp(self):
        self.grid = HexGrid(1000, 5, 4)

    def test_id_and_roundtrip(self):
        for cell in range(self.grid.size):
            c, r = self.grid.col_row(cell)
            self.assertEqual(self.grid.index(c, r), cell)
            x, y = self.grid.center(c, r)
            self.assertEqual(self.grid.cell_at(x, y), cell)

    def test_odd_rows_offset_and_neighbours(self):
        self.assertAlmostEqual(self.grid.center(0, 1)[0], math.sqrt(3) * 500)
        self.assertEqual(self.grid.neighbors(0), [1, 5])
        self.assertEqual(len(self.grid.neighbors(6)), 6)
        self.assertEqual(self.grid.cell_at(float("nan"), 0), -1)
        self.assertEqual(self.grid.cell_at(-100000, -100000), -1)

    @unittest.skipUnless(shutil.which("node"), "Node not installed")
    def test_js_parity_for_all_cells(self):
        script = """
        import {HexGrid} from './web/js/hex.mjs';
        const h = new HexGrid({radius_m:1000,cols:5,rows:4,origin_x_m:0,origin_y_m:0});
        console.log(JSON.stringify(Array.from({length:h.size},(_,id) => {
          const [col,row] = h.colRow(id);
          const [x,y] = h.center(col,row);
          return {id,x,y,cellAt:h.cellAt(x,y),neighbors:h.neighbors(id)};
        })));
        """
        p = subprocess.run(["node","--input-type=module","-e",script],cwd=ROOT,
                           text=True,capture_output=True,check=True)
        vectors = json.loads(p.stdout)
        for v in vectors:
            c, r = self.grid.col_row(v["id"])
            x, y = self.grid.center(c,r)
            self.assertAlmostEqual(x,v["x"],places=8)
            self.assertAlmostEqual(y,v["y"],places=8)
            self.assertEqual(self.grid.cell_at(x,y),v["cellAt"])
            self.assertEqual(self.grid.neighbors(v["id"]),v["neighbors"])


if __name__ == "__main__":
    unittest.main()
