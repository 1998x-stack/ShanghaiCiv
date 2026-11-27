import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateBundle, comparable} from "../../web/js/contracts.mjs";
import {HexGrid} from "../../web/js/hex.mjs";
const fixture = yr => JSON.parse(readFileSync(new URL(`../fixtures/synthetic/synthetic_${yr}.json`, import.meta.url)));
const clone = x => structuredClone(x);

test("both synthetic fixtures pass JS contract", () => {
  for (const year of ["2024","2025"]) assert.deepEqual(validateBundle(fixture(year)),[]);
});

test("source, year, null and fake hex are rejected", () => {
  const x = fixture("2024");
  x.metrics[0].source_id = "unknown";
  assert(validateBundle(x).includes("METRIC_SOURCE_REF"));
  const y = fixture("2024");
  y.metrics[0].period = "";
  assert(validateBundle(y).includes("METRIC_PERIOD"));
  const z = fixture("2024");
  z.metrics[3].value = 0;
  assert(validateBundle(z).includes("METRIC_STATUS_VALUE"));
  const g = fixture("2024");
  g.metrics[0].granularity = "hex_cell";
  g.metrics[0].geography_id = "hex:0";
  assert(validateBundle(g).includes("METRIC_NATIVE_GRANULARITY"));
  assert(validateBundle(g).includes("METRIC_HEX_OBSERVATION"));
});

test("no accidental release promotion", () => {
  const x = fixture("2024");
  x.release.publish_approved = true;
  assert(validateBundle(x).includes("RELEASE_SYNTHETIC_PUBLISH"));
  assert(validateBundle(x).includes("SOURCE_RELEASE"));
});

test("same name does not imply duplicate region ID", () => {
  const x = fixture("2024");
  assert.equal(x.regions.filter(r => r.name_zh === "示例园区").length,2);
  assert.deepEqual(validateBundle(x),[]);
});

test("comparability respects period and units", () => {
  const x = fixture("2024");
  assert.equal(comparable(x.metrics[0],x.metrics[1]),true);
  const y = clone(x.metrics[1]);
  y.period = "2025";
  assert.equal(comparable(x.metrics[0],y),false);
});

test("hex grid all centres roundtrip with boundary neighbours", () => {
  const hex = new HexGrid({radius_m:1000,cols:5,rows:4});
  for (let i=0;i<hex.size;i++) {
    const [c,r] = hex.colRow(i);
    const [x,y] = hex.center(c,r);
    assert.equal(hex.cellAt(x,y),i);
  }
  assert.deepEqual(hex.neighbors(0),[1,5]);
  assert.equal(hex.neighbors(6).length,6);
  assert.equal(hex.cellAt(NaN,0),-1);
});
