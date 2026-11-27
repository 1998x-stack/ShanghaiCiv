import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assertSyntheticScene} from "../../web/js/synthetic-spatial.mjs";
import {
  buildExplorerView,compareDistricts,scatterData,syntheticCSV,
  EXPLORER_METRICS,EXPLORER_PERIODS
} from "../../web/js/explorer.mjs";

const fixture=n=>JSON.parse(readFileSync(
  new URL("../fixtures/synthetic/"+n,import.meta.url),"utf8"));
const scene=assertSyntheticScene(fixture("synthetic_gis_scene.json"));
const bundles={"2024":fixture("synthetic_2024.json"),"2025":fixture("synthetic_2025.json")};
const A="synthetic-district-a",B="synthetic-district-b";

test("P10 accepts only synthetic district-level paired period contracts",()=>{
  assert.deepEqual(EXPLORER_METRICS,["population","population_density"]);
  assert.deepEqual(EXPLORER_PERIODS,["2024","2025"]);
  const v=buildExplorerView(bundles,scene,"2024");
  assert.equal(v.synthetic,true);
  assert.equal(v.publish_approved,false);
  assert.equal(v.rows.length,2);
  assert(v.rows.every(r=>r.period==="2024"&&r.region_id.startsWith("synthetic-district-")));
  assert.throws(()=>buildExplorerView(bundles,scene,"2026"),/EXPLORER_INVALID_PERIOD/);
  const other=structuredClone(bundles);other["2024"].release.publish_approved=true;
  assert.throws(()=>buildExplorerView(other,scene,"2024"),/P08_/);
  assert.throws(()=>buildExplorerView(bundles,{...scene,synthetic:false},"2024"),/P08_/);
});

test("sorting 2024 population desc/asc keeps original district values",()=>{
  const d=buildExplorerView(bundles,scene,"2024","population","desc");
  const a=buildExplorerView(bundles,scene,"2024","population","asc");
  assert.deepEqual(d.rows.map(r=>r.region_id),[A,B]);
  assert.deepEqual(a.rows.map(r=>r.region_id),[B,A]);
  assert.deepEqual(d.rows.map(r=>r.metrics.population.value),[100000,50000]);
  assert.deepEqual(a.rows.map(r=>r.metrics.population.value),[50000,100000]);
  assert(d.rows.every(r=>r.metrics.population.granularity==="district"));
});

test("missing density remains null, sorts last both ways and never ranks as 0",()=>{
  for(const year of EXPLORER_PERIODS){
    for(const dir of ["asc","desc"]){
      const v=buildExplorerView(bundles,scene,year,"population_density",dir);
      assert.deepEqual(v.rows.map(r=>r.region_id),[A,B]);
      assert.equal(v.rows[1].metrics.population_density.value,null);
      assert.equal(v.rows[1].metrics.population_density.status,"unavailable");
      assert.equal(v.completeCount,1);
      assert.equal(v.missingCount,1);
    }
  }
  const v=buildExplorerView(bundles,scene,"2025","population");
  assert.equal(v.completeCount,1);
  assert.equal(v.missingCount,1);
  assert.equal(v.rows.find(r=>r.region_id===B).metrics.population.value,null);
});

test("district comparisons require same year, definition, method and complete values",()=>{
  const v=buildExplorerView(bundles,scene,"2024");
  const result=compareDistricts(v,A,B,"population");
  assert.equal(result.comparable,true);
  assert.equal(result.difference,50000);
  assert.equal(result.leftText,"100,000 人");
  assert.equal(result.rightText,"50,000 人");
  assert.equal(result.period,"2024");
  assert.match(result.message,/合成区级/);
  assert.equal(compareDistricts(v,A,A,"population").code,"SAME_DISTRICT");
  assert.equal(compareDistricts(v,A,"no-such-region","population").code,"MISSING_REGION");
  const v25=buildExplorerView(bundles,scene,"2025");
  assert.equal(compareDistricts(v25,A,B,"population").code,"MISSING_VALUE");
  assert.equal(compareDistricts(v,A,B,"population_density").code,"MISSING_VALUE");
  assert.throws(()=>compareDistricts(v,A,B,"industrial_index"),RangeError);
  const mutated=structuredClone(v);
  mutated.rows.find(r=>r.region_id===B).metrics.population.unit="kilograms";
  assert.equal(compareDistricts(mutated,A,B,"population").code,"INCOMPATIBLE_DEFINITION");
  const crossed=structuredClone(v);
  crossed.rows.find(r=>r.region_id===B).period="2025";
  assert.equal(compareDistricts(crossed,A,B,"population").code,"CROSS_PERIOD");
  const newSource=structuredClone(v);
  newSource.rows.find(r=>r.region_id===B).metrics.population.source_id="SYN-002";
  assert.equal(compareDistricts(newSource,A,B,"population").code,"INCOMPATIBLE_DEFINITION");
});

test("scatter omits missing X/Y and refuses correlation claims with tiny sample",()=>{
  for(const year of EXPLORER_PERIODS){
    const v=buildExplorerView(bundles,scene,year);
    const plot=scatterData(v);
    assert.equal(plot.points.length,1);
    assert.equal(plot.omitted.length,1);
    assert.equal(plot.points[0].region_id,A);
    assert.deepEqual(plot.omitted,[B]);
    assert.equal(plot.correlationAllowed,false);
    assert.match(plot.warning,/不计算相关性/);
    assert.equal(plot.points[0].xUnit,"persons");
    assert.equal(plot.points[0].yUnit,"persons_per_km2");
  }
  assert.throws(()=>scatterData(buildExplorerView(bundles,scene,"2024"),"population","population"),RangeError);
});

test("guarded CSV includes explicit synthetic warning, provenance, null and no hex precision",()=>{
  const v=buildExplorerView(bundles,scene,"2025");
  const csv=syntheticCSV(v);
  assert(csv.startsWith("\uFEFF"));
  assert(csv.includes("SYNTHETIC TEST ONLY - NOT REAL SHANGHAI DATA"));
  assert(csv.includes('"reference_period"'));
  assert(csv.includes('"source_id"'));
  assert(csv.includes('"source_url"'));
  assert(csv.includes('"method_id"'));
  assert(csv.includes('"license_status"'));
  assert(csv.includes('"publish_approved"'));
  assert(csv.includes('"FICTIONAL_FIXTURE"'));
  assert(csv.includes('"SYN-001"'));
  assert(csv.includes('"unavailable"'));
  assert(csv.includes('"synthetic_fixture|missing_value"'));
  assert(csv.includes('"false"'));
  assert(!csv.includes("hex_cell"));
  const lines=csv.trim().replace(/^\uFEFF/,"").split("\r\n");
  assert.equal(lines.length,6); // comment + header + 2 districts × 2 metrics
  assert.throws(()=>syntheticCSV(v,"production"),/EXPLORER_PRODUCTION_EXPORT_BLOCKED/);
  const invalid=structuredClone(v);invalid.publish_approved=true;
  assert.throws(()=>syntheticCSV(invalid),/EXPLORER_PRODUCTION_EXPORT_BLOCKED/);
  const wrong=structuredClone(v);wrong.rows[0].metrics.population.license_status="unknown";
  assert.throws(()=>syntheticCSV(wrong),/EXPLORER_EXPORT_SOURCE_UNAPPROVED/);
  const disabled=structuredClone(v);disabled.rows[1].metrics.population.redistribution_allowed=false;
  assert.throws(()=>syntheticCSV(disabled),/EXPLORER_EXPORT_SOURCE_UNAPPROVED/);
});

test("CSV formula injection is escaped, not interpreted as spreadsheet commands",()=>{
  const v=buildExplorerView(bundles,scene,"2024");
  const mutated=structuredClone(v);
  mutated.rows[0].name="=HYPERLINK(\"https://attack.invalid\",\"click\")";
  const csv=syntheticCSV(mutated);
  assert(csv.includes("'=HYPERLINK"));
  assert(!csv.includes('"=HYPERLINK'));
});

test("GDP and industry comparisons without actual district data remain excluded",()=>{
  const v=buildExplorerView(bundles,scene,"2024");
  assert.deepEqual(Object.keys(v.metrics).sort(),["population","population_density"]);
  assert.throws(()=>buildExplorerView(bundles,scene,"2024","gdp"),RangeError);
  assert.throws(()=>compareDistricts(v,A,B,"industrial_index"),RangeError);
});
