import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {Camera} from "../../web/js/camera.mjs";
import {assertSyntheticScene,buildSyntheticCoverage,intersectionArea} from "../../web/js/synthetic-spatial.mjs";

const scene=JSON.parse(readFileSync(new URL("../fixtures/synthetic/synthetic_gis_scene.json",import.meta.url)));

test("P04 synthetic fixture accepted and real CRS rejected",()=>{
  assert.equal(assertSyntheticScene(scene).synthetic,true);
  const bad=structuredClone(scene);bad.canonical_crs="EPSG:4326";
  assert.throws(()=>assertSyntheticScene(bad),/UNAPPROVED_OR_INVALID_MAP_SOURCE/);
  const missing=structuredClone(scene);delete missing.disclosure;
  assert.throws(()=>assertSyntheticScene(missing));
});

test("synthetic browser geometry partitions 56 hex cells",()=>{
  const result=buildSyntheticCoverage(scene);
  assert.equal(result.cells.length,56);
  assert.equal(result.grid.size,56);
  assert(result.cells.some(c=>c.partial_cell));
  assert(result.cells.some(c=>c.water_fraction>.1));
  assert(result.cells.some(c=>c.land_fraction>.1));
  for(const c of result.cells){
    assert(Math.abs(c.land_fraction+c.water_fraction+c.outside_fraction-1)<5e-7);
    assert(Math.abs((result.byCell.get(c.cell_id)||[]).reduce((s,m)=>s+m.fraction,0)-c.land_fraction)<5e-7);
  }
});

test("synthetic polygon hole prevents water overlap on detached island",()=>{
  const {grid,cells}=buildSyntheticCoverage(scene);
  const id=grid.cellAt(4850,3800);
  assert(id>=0);
  const island=scene.regions[1].geometry,sea=scene.surfaces[1].geometry;
  const [col,row]=grid.colRow(id);
  const hex=grid.vertices(col,row);
  assert(intersectionArea(island,hex)>0);
  assert(intersectionArea(sea,hex)>=0);
  assert(cells[id].land_fraction+cells[id].water_fraction<=1+2e-7);
});

test("browser spatial coverage matches Python P04 output if generated",t=>{
  const path=".p07-work/spatial/coverage.synthetic.json";
  if(!existsSync(path))return t.skip("Run python -m pipeline spatial --workspace .p07-work first");
  const python=JSON.parse(readFileSync(path,"utf8"));
  const js=buildSyntheticCoverage(scene);
  assert.equal(python.cells.length,js.cells.length);
  for(let i=0;i<js.cells.length;i++){
    const p=python.cells[i],j=js.cells[i];
    assert.equal(p.cell_id,j.cell_id);
    assert.equal(p.dominant,j.dominant);
    assert.equal(p.partial_cell,j.partial_cell);
    for(const key of ["land_fraction","water_fraction","outside_fraction"]) {
      assert(Math.abs(p[key]-j[key])<2e-7,"cell "+i+" mismatch "+key+": "+p[key]+" vs "+j[key]);
    }
  }
});

test("camera screen-world roundtrips and anchor zoom",()=>{
  const c=new Camera();c.resize(1000,700);c.fitBounds([-1000,-700,8000,5200]);
  const p=[320,280],world=c.screenToWorld(...p);
  c.zoomAt(...p,1.3);
  const after=c.screenToWorld(...p);
  assert(Math.abs(world[0]-after[0])<1e-8);
  assert(Math.abs(world[1]-after[1])<1e-8);
  const pt=c.worldToScreen(...world);
  assert(Math.abs(pt[0]-p[0])<1e-8);
  assert(Math.abs(pt[1]-p[1])<1e-8);
  c.panPixels(80,-60);
  const vp=c.viewportWorld();
  assert(vp[0]<vp[2]&&vp[1]<vp[3]);
  assert.equal(c.restore({x:10,y:20,z:.2}),true);
  assert.equal(c.centerX,10);
  assert.equal(c.restore({x:0,y:0,z:Infinity}),false);
});
