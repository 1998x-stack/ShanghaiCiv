import test from "node:test";
import assert from "node:assert/strict";
import {HexGrid} from "../../web/js/hex.mjs";

test("pointy-top hex vertices and bounds have matching metric geometry", () => {
  const h = new HexGrid({radius_m:500,cols:8,rows:7});
  const vertices = h.vertices(0,0);
  assert.equal(vertices.length,6);
  assert(Math.abs(vertices[0][0]) < 1e-9);
  assert.equal(vertices[0][1],-500);
  const [xmin,ymin,xmax,ymax] = h.cellBounds(0,0);
  assert(Math.abs(xmin + Math.sqrt(3)*250)<1e-9);
  assert.equal(ymin,-500);
  assert.equal(ymax,500);
  assert(xmax>0);
});

test("synthetic viewport includes intersecting hex and has unique indices", () => {
  const h = new HexGrid({radius_m:500,cols:8,rows:7});
  const full = h.visibleCells(-2000,-2000,10000,10000);
  assert.deepEqual(full,Array.from({length:56},(_,i)=>i));
  assert.deepEqual(h.visibleCells(100000,100000,101000,101000),[]);
  const [cx,cy] = h.center(5,5);
  const near = h.visibleCells(cx-20,cy-20,cx+20,cy+20);
  assert(near.includes(h.index(5,5)));
  assert.deepEqual(near,[...new Set(near)]);
  assert.deepEqual(near,[...near].sort((a,b)=>a-b));
});

test("invalid viewport fails explicitly", () => {
  const h = new HexGrid({radius_m:500,cols:8,rows:7});
  assert.throws(()=>h.visibleCells(NaN,0,10,10), RangeError);
  assert.throws(()=>h.visibleCells(10,10,0,0), RangeError);
});
