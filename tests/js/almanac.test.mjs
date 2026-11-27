import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  assertSyntheticData,lensCatalog,districtMetricsView,metricFor,numericString,
  comparePeriods,traceMetric,relatedZoneEstimates,SUPPORTED_PERIODS
} from "../../web/js/almanac.mjs";
const fixture=(file)=>JSON.parse(readFileSync(new URL("../fixtures/synthetic/"+file,import.meta.url),"utf8"));
const scene=fixture("synthetic_gis_scene.json");
const bundles={"2024":fixture("synthetic_2024.json"),"2025":fixture("synthetic_2025.json")};
const clone=x=>structuredClone(x);
const IDA="synthetic-district-a",IDB="synthetic-district-b";

test("P08 accepts only versioned explicitly unpublishable invented datasets",()=>{
  assert.equal(assertSyntheticData(bundles,scene),bundles);
  assert.deepEqual(SUPPORTED_PERIODS,["2024","2025"]);
  const bad=clone(bundles);
  bad["2024"].release.publish_approved=true;
  assert.throws(()=>assertSyntheticData(bad,scene),/P08_CONTRACT_|P08_RELEASE_GUARD_/);
  const real=clone(scene);real.canonical_crs="EPSG:4326";
  assert.throws(()=>assertSyntheticData(bundles,real),/P08_UNAPPROVED_GEOGRAPHY/);
});

test("P08 refuses mismatched chronology, fake geographies and source status",()=>{
  const bad=clone(bundles);
  bad["2025"].metrics[0].period="2024";
  assert.throws(()=>assertSyntheticData(bad,scene),/P08_PERIOD_MISMATCH_/);
  const unknown=clone(bundles);
  unknown["2025"].metrics[0].geography_id="nonexistent";
  assert.throws(()=>assertSyntheticData(unknown,scene),/P08_CONTRACT_|P08_DISTRICT_GEOMETRY_MISMATCH/);
  const licence=clone(bundles);
  licence["2024"].sources[0].license_status="allowed";
  assert.throws(()=>assertSyntheticData(licence,scene),/P08_CONTRACT_|P08_SOURCE_GUARD_/);
});

test("2024/2025 two district lenses remain district-scale without hex metrics",()=>{
  const lenses=lensCatalog(bundles);
  assert.equal(lenses.length,2);
  for(const period of SUPPORTED_PERIODS){
    for(const lens of lenses){
      const result=districtMetricsView(bundles[period],lens,scene);
      assert.equal(result.synthetic,true);
      assert.equal(result.granularity,"district");
      assert.equal(result.items.length,2);
      assert(result.items.every(x=>x.id.startsWith("synthetic-district-")));
      assert(!result.items.some(x=>x.metric?.granularity==="hex_cell"));
    }
  }
});

test("2025 missing district is null and not zero; density missing both years",()=>{
  const pop=lensCatalog(bundles)[0],density=lensCatalog(bundles)[1];
  const a=districtMetricsView(bundles["2025"],pop,scene);
  const b=a.items.find(x=>x.id===IDB);
  assert.equal(b.value,null);
  assert.equal(b.status,"unavailable");
  assert.equal(a.observedCount,1);
  assert.equal(a.missingCount,1);
  assert.equal(numericString(b.value,"persons"),"暂无数据");
  assert.equal(numericString(0,"persons"),"0 人");
  for(const period of SUPPORTED_PERIODS){
    const lens=districtMetricsView(bundles[period],density,scene);
    assert.equal(lens.items.find(x=>x.id===IDB).value,null);
  }
});

test("synthetic period comparison is only allowed for compatible complete metrics",()=>{
  const p1=metricFor(bundles["2024"],"population",IDA);
  const p2=metricFor(bundles["2025"],"population",IDA);
  const diff=comparePeriods(p1,p2);
  assert.equal(diff.comparable,true);
  assert.equal(diff.code,"SYNTHETIC_DEMO_ONLY");
  assert.equal(diff.difference,10000);
  assert.equal(diff.percentage,10);
  assert.match(diff.label,/合成/);
  const missing=comparePeriods(metricFor(bundles["2024"],"population",IDB),
                               metricFor(bundles["2025"],"population",IDB));
  assert.equal(missing.comparable,false);
  assert.equal(missing.code,"MISSING_VALUE");
  const changed=clone(p2);changed.unit="CNY";
  assert.equal(comparePeriods(p1,changed).code,"METRIC_DEFINITION_CHANGED");
  const redefined=clone(p2);redefined.status="derived";redefined.method_id="not_matching";
  assert.equal(comparePeriods(p1,redefined).code,"METHOD_CHANGED");
});

test("almanac source, unit, method and quality flags trace back to synthetic fixture",()=>{
  const density=metricFor(bundles["2024"],"population_density",IDA);
  const trace=traceMetric(bundles["2024"],density);
  assert.equal(trace.source.id,"SYN-001");
  assert.equal(trace.source.native_granularity,"district");
  assert.equal(trace.method,"synthetic_population_divided_by_area");
  assert.equal(trace.period,"2024");
  assert.deepEqual(trace.flags,["synthetic_fixture"]);
  assert.equal(trace.statusLabel,"模拟派生");
  const none=traceMetric(bundles["2025"],metricFor(bundles["2025"],"population",IDB));
  assert.equal(none.statusLabel,"暂无数据");
  assert.equal(none.method,null);
});

test("isolated synthetic zone estimate is shown as estimated, not district or hex data",()=>{
  const estimated=relatedZoneEstimates(bundles["2024"],IDA);
  assert.equal(estimated.length,1);
  assert.equal(estimated[0].metric.metric_id,"industrial_index");
  assert.equal(estimated[0].metric.status,"estimated");
  assert.equal(estimated[0].trace.method,"synthetic_estimation");
  assert(estimated[0].trace.flags.includes("modeled"));
  assert.equal(relatedZoneEstimates(bundles["2025"],IDA).length,0);
  assert.equal(relatedZoneEstimates(bundles["2024"],IDB).length,0);
});
