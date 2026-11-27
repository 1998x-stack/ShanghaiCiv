"""P04 synthetic GIS correctness tests: no real Shanghai geometries."""
from __future__ import annotations

import copy
import json
import math
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from pipeline.build.spatial import (SCENE, _assert_synthetic, _intersections,
                                     benchmark_grid_sizes, build_synthetic_world,
                                     check_synthetic_world)
from pipeline.core.geo import (SyntheticLocalProjection, clip_to_convex_polygon,
                               intersection_area, locate_point, polygon_area, signed_area)
from pipeline.core.hexgrid import HexGrid
from pipeline.core.store import sha256, write_json


ROOT = Path(__file__).resolve().parents[1]


class TestSyntheticGeometry(unittest.TestCase):
    def setUp(self) -> None:
        self.scene = json.loads(SCENE.read_text(encoding="utf-8"))
        self.grid = HexGrid.from_contract(self.scene["grid"])

    def test_scene_is_explicitly_fictional(self):
        self.assertEqual(self.scene["canonical_crs"], "SYNTHETIC_LOCAL_METERS")
        self.assertTrue(self.scene["synthetic"])
        _assert_synthetic(self.scene)

    def test_real_crs_is_blocked(self):
        with self.assertRaisesRegex(PermissionError, "REAL_CRS_TRANSFORM_NOT_IMPLEMENTED"):
            SyntheticLocalProjection("EPSG:4326")
        other = copy.deepcopy(self.scene)
        other["canonical_crs"] = "EPSG:3857"
        with self.assertRaisesRegex(PermissionError, "REAL_GIS_GEOMETRY_NOT_APPROVED"):
            _assert_synthetic(other)

    def test_projection_offset_roundtrip(self):
        proj = SyntheticLocalProjection(origin_x_m=1250, origin_y_m=-400)
        for x, y in ((0,0), (2000,2300), (-500,-800)):
            self.assertEqual(proj.inverse(*proj.forward(x, y)), (x,y))
        with self.assertRaises(ValueError):
            proj.forward(float("nan"), 0)

    def test_area_of_multipolygon_and_ocean_hole(self):
        a, b = self.scene["regions"]
        river, ocean = self.scene["surfaces"]
        self.assertAlmostEqual(polygon_area(a["geometry"]), 3800 * 3700)
        self.assertAlmostEqual(polygon_area(b["geometry"]), 4300 * 3700 + 650 * 650)
        self.assertAlmostEqual(polygon_area(river["geometry"]), 200 * 3700)
        self.assertAlmostEqual(polygon_area(ocean["geometry"]), 9000 * 2200 - 650 * 650)

    def test_point_location_boundary_holes_and_island(self):
        a, b = self.scene["regions"]
        river, sea = self.scene["surfaces"]
        self.assertEqual(locate_point((100,100), a["geometry"]), "inside")
        self.assertEqual(locate_point((10000,100), a["geometry"]), "outside")
        self.assertEqual(locate_point((3100,500), a["geometry"]), "boundary")
        self.assertEqual(locate_point((3200,500), river["geometry"]), "inside")
        self.assertEqual(locate_point((4800,3750), b["geometry"]), "inside")
        self.assertEqual(locate_point((4800,3750), sea["geometry"]), "outside")
        self.assertEqual(locate_point((4800,3550), sea["geometry"]), "boundary")
        self.assertEqual(locate_point((5300,3750), sea["geometry"]), "inside")

    def test_convex_clip_area_and_reverse_winding(self):
        square = {"type":"Polygon","coordinates":[[[-1000,-1000],[1000,-1000],[1000,1000],[-1000,1000]]]}
        vertices = self.grid.vertices(0,0)
        hex_area = 3 * math.sqrt(3) * 500**2 / 2
        self.assertAlmostEqual(abs(signed_area(vertices)), hex_area, places=6)
        self.assertAlmostEqual(intersection_area(square, vertices), hex_area, places=6)
        self.assertAlmostEqual(intersection_area(square, vertices[::-1]), hex_area, places=6)
        distant = {"type":"Polygon","coordinates":[[[10000,10000],[11000,10000],[11000,11000],[10000,11000]]]}
        self.assertEqual(intersection_area(distant, vertices), 0)

    def test_mixed_cells_respect_partition_and_island(self):
        world, coverage, summary = _intersections(self.scene, self.grid)
        self.assertEqual(len(coverage["cells"]), 8 * 7)
        self.assertGreater(summary["partial_cell_count"], 0)
        self.assertGreater(summary["island_cell_count"], 0)
        self.assertGreater(summary["river_or_coast_cell_count"], 0)
        memberships = {}
        for m in world["memberships"]:
            memberships.setdefault(m["cell_id"], []).append(m)
        for cell in coverage["cells"]:
            total = cell["land_fraction"] + cell["water_fraction"] + cell["outside_fraction"]
            self.assertAlmostEqual(total, 1, places=6)
            self.assertAlmostEqual(sum(m["fraction"] for m in memberships.get(cell["cell_id"], [])),
                                   cell["land_fraction"], places=6)
            self.assertLessEqual(sum(m["fraction"] for m in memberships.get(cell["cell_id"], [])), 1.000001)

    def test_overlapping_districts_are_rejected(self):
        other = copy.deepcopy(self.scene)
        main = other["regions"][1]["geometry"]["coordinates"][0][0]
        for i in (0,3,4):
            main[i][0] = 1000
        with self.assertRaisesRegex(ValueError, "GEOMETRY_PARTITION_OVERLAP"):
            _intersections(other, self.grid)

    def test_viewport_culling_includes_cell_bounds_and_excludes_far(self):
        self.assertEqual(self.grid.visible_cells(100000,100000,101000,101000), [])
        all_ids = self.grid.visible_cells(-2000,-2000,10000,10000)
        self.assertEqual(all_ids, list(range(self.grid.size)))
        col, row = 5,5
        cx,cy = self.grid.center(col,row)
        view = self.grid.visible_cells(cx-20,cy-20,cx+20,cy+20)
        self.assertIn(self.grid.index(col,row), view)
        self.assertEqual(len(set(view)),len(view))
        self.assertEqual(view, sorted(view))

    def test_candidate_grid_sizes(self):
        rows = benchmark_grid_sizes((-1000,-700,8000,5200))
        self.assertEqual([r["radius_m"] for r in rows],[500,1000,2000])
        self.assertGreater(rows[0]["candidate_cells"],rows[1]["candidate_cells"])
        self.assertGreater(rows[1]["candidate_cells"],rows[2]["candidate_cells"])

    @unittest.skipUnless(shutil.which("node"), "Node not installed")
    def test_browser_hex_vertices_and_viewport_parity(self):
        script = """
        import {HexGrid} from './web/js/hex.mjs';
        const h = new HexGrid({radius_m:500,cols:8,rows:7,origin_x_m:0,origin_y_m:0});
        const views = [[-2000,-2000,10000,10000],[100000,100000,101000,101000],
                       [4000,3300,5200,4200],[-500,-500,500,500],[2999,500,3333,1500]];
        console.log(JSON.stringify({vertices:Array.from({length:h.size},(_,i)=>{
          const [c,r] = h.colRow(i); return h.vertices(c,r);
        }),views:views.map(v=>h.visibleCells(...v))}));
        """
        p = subprocess.run(["node","--input-type=module","-e",script],cwd=ROOT,
                           text=True,capture_output=True,check=True)
        data = json.loads(p.stdout)
        for i, vertices in enumerate(data["vertices"]):
            c,r = self.grid.col_row(i)
            for pair in zip(vertices,self.grid.vertices(c,r)):
                self.assertAlmostEqual(pair[0][0],pair[1][0],places=7)
                self.assertAlmostEqual(pair[0][1],pair[1][1],places=7)
        views = [(-2000,-2000,10000,10000),(100000,100000,101000,101000),
                 (4000,3300,5200,4200),(-500,-500,500,500),(2999,500,3333,1500)]
        self.assertEqual([self.grid.visible_cells(*v) for v in views],data["views"])


class TestSpatialBuild(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.workspace = Path(self.tmp.name) / "work"

    def test_build_is_offline_deterministic_and_schema_valid(self):
        manifest = build_synthetic_world(self.workspace)
        self.assertEqual(manifest["p01_g1_status"],"BLOCKED")
        self.assertFalse(manifest["public_map_release_approved"])
        quality = check_synthetic_world(self.workspace)
        self.assertEqual(quality["status"],"PASS",quality["failures"])
        hashes_before = {f.name:sha256(f.read_bytes()) for f in (self.workspace/"spatial").glob("*.json")}
        build_synthetic_world(self.workspace)
        hashes_after = {f.name:sha256(f.read_bytes()) for f in (self.workspace/"spatial").glob("*.json")}
        self.assertEqual(hashes_before,hashes_after)
        self.assertFalse((self.workspace/"web/data").exists())

        try:
            import jsonschema
        except ImportError:
            self.skipTest("Install requirements-test.txt for JSON Schema 2020-12 check")
        schema = json.loads((ROOT/"schemas/world.schema.json").read_text())
        world = json.loads((self.workspace/"spatial/world.synthetic.json").read_text())
        self.assertEqual(list(jsonschema.Draft202012Validator(schema).iter_errors(world)),[])
        coverage_schema = json.loads((ROOT/"schemas/spatial-coverage.schema.json").read_text())
        coverage = json.loads((self.workspace/"spatial/coverage.synthetic.json").read_text())
        self.assertEqual(list(jsonschema.Draft202012Validator(coverage_schema).iter_errors(coverage)),[])

    def test_coverage_mismatch_rejected_even_with_updated_hash(self):
        build_synthetic_world(self.workspace)
        cover_file = self.workspace/"spatial/coverage.synthetic.json"
        manifest_file = self.workspace/"spatial/manifest.synthetic.json"
        cover = json.loads(cover_file.read_text())
        original_land = cover["cells"][0]["land_fraction"]
        self.assertGreater(original_land,0.5)
        cover["cells"][0]["land_fraction"] = 0.7
        cover["cells"][0]["outside_fraction"] = 0.3
        cover["cells"][0]["water_fraction"] = 0
        cover["cells"][0]["partial_cell"] = True
        digest = write_json(cover_file, cover)
        manifest = json.loads(manifest_file.read_text())
        manifest["coverage_sha256"] = digest
        write_json(manifest_file, manifest)
        result = check_synthetic_world(self.workspace)
        self.assertEqual(result["status"],"FAIL")
        self.assertIn("LAND_MEMBERSHIP_MISMATCH", result["failures"][0])

    def test_tampered_world_or_manifest_causes_fail(self):
        build_synthetic_world(self.workspace)
        path = self.workspace/"spatial/world.synthetic.json"
        path.write_bytes(b'{"tampered":true}')
        q = check_synthetic_world(self.workspace)
        self.assertEqual(q["status"],"FAIL")
        self.assertIn("SHA256_MISMATCH",q["failures"][0])
        build_synthetic_world(self.workspace)
        self.assertEqual(check_synthetic_world(self.workspace)["status"],"PASS")

    def test_publication_gate_rejects_mutated_manifest(self):
        build_synthetic_world(self.workspace)
        manifest_path = self.workspace/"spatial/manifest.synthetic.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["public_map_release_approved"] = True
        manifest_path.write_text(json.dumps(manifest))
        q = check_synthetic_world(self.workspace)
        self.assertEqual(q["status"],"FAIL")
        self.assertIn("SPATIAL_PUBLICATION_GATE_BYPASS",q["failures"][0])


if __name__ == "__main__":
    unittest.main()
