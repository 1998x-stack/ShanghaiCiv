/**
 * P08: pure synthetic statistical lenses and source-traceability.
 * Metrics remain at their original geography: district or zone, NEVER hex.
 * Cross-period comparisons are demo-only and require explicit comparability.
 */
import {validateBundle} from "./contracts.mjs";

const P = Object.freeze(["2024","2025"]);
const statusLabel = Object.freeze({
  observed:"模拟观测",derived:"模拟派生",estimated:"模拟估算",unavailable:"暂无数据"
});
const statusExplanation = Object.freeze({
  observed:"本文件中是人为虚构的来源字段，不是真实上海观测。",
  derived:"由虚构输入按声明方法演算；方法不等于官方统计口径。",
  estimated:"按虚构模型生成，不能称为官方真实数据。",
  unavailable:"没有提供数值，null 不等于零；不得进入排名。"
});

export function assertSyntheticData(bundles, scene) {
  if(!scene || scene.synthetic!==true ||
      scene.canonical_crs!=="SYNTHETIC_LOCAL_METERS" ||
      !Array.isArray(scene.regions))throw new Error("P08_UNAPPROVED_GEOGRAPHY");
  if(!bundles || typeof bundles!=="object")throw new Error("P08_MISSING_BUNDLES");
  const sceneIds=new Set(scene.regions.map(r=>r.id));
  for(const period of P) {
    const b=bundles[period];
    if(!b)throw new Error("P08_MISSING_PERIOD_"+period);
    const errors=validateBundle(b);
    if(errors.length)throw new Error("P08_CONTRACT_"+period+":"+errors.join(","));
    if(b.release?.synthetic!==true||b.release?.publish_approved!==false||
       b.release?.license_review!=="blocked"||b.release?.data_vintage!==period)
      throw new Error("P08_RELEASE_GUARD_"+period);
    if(b.sources.some(s=>s.license_status!=="synthetic"||
                         s.native_granularity!=="district"))
      throw new Error("P08_SOURCE_GUARD_"+period);
    if(b.metrics.some(m=>m.period!==period))
      throw new Error("P08_PERIOD_MISMATCH_"+period);
    const districtMetrics=b.metrics.filter(m=>m.granularity==="district");
    if(districtMetrics.some(m=>!sceneIds.has(m.geography_id)))
      throw new Error("P08_DISTRICT_GEOMETRY_MISMATCH_"+period);
    if(b.lenses.some(l=>l.granularity!=="district"))
      throw new Error("P08_LENS_NOT_DISTRICT_"+period);
    if(new Set(b.lenses.map(l=>l.id)).size!==b.lenses.length)
      throw new Error("P08_DUPLICATE_LENSES_"+period);
  }
  const a=bundles["2024"],b=bundles["2025"];
  if(JSON.stringify(a.lenses)!==JSON.stringify(b.lenses))
    throw new Error("P08_INCOMPATIBLE_LENS_CATALOG");
  return bundles;
}

export function lensCatalog(bundles) {
  return bundles["2024"].lenses.map(x=>({...x}));
}

export function metricFor(bundle, id, geographyId) {
  return bundle.metrics.find(m=>m.metric_id===id&&m.geography_id===geographyId)??null;
}

export function districtMetricsView(bundle, lens, scene) {
  if(lens.granularity!=="district")throw new Error("P08_LENS_MUST_BE_DISTRICT");
  const items=scene.regions.map(region=>{
    const metric=metricFor(bundle,lens.metric_id,region.id);
    return {
      id:region.id,name:region.name_zh,
      value:metric?.value??null,metric,
      status:metric?.status??"unavailable",
      source:bundle.sources.find(s=>s.id===metric?.source_id)??null
    };
  });
  const present=items.filter(x=>x.value!==null&&Number.isFinite(x.value));
  const numeric=present.map(x=>x.value);
  const min=numeric.length?Math.min(...numeric):null;
  const max=numeric.length?Math.max(...numeric):null;
  // 5-step scale: district polygon fills, not per-cell statistical values.
  function color(item) {
    if(item.value===null)return "#56606b";
    if(min===max)return "#86b1a0";
    const t=(item.value-min)/(max-min);
    const colors=["#588d92","#719d9b","#8faf9e","#b2bd91","#d0bd7b"];
    return colors[Math.min(4,Math.max(0,Math.floor(t*4.999)))];
  }
  return {
    period:bundle.release.data_vintage,
    lens,items:items.map(item=>({...item,color:color(item)})),
    min,max,observedCount:present.length,
    missingCount:items.length-present.length,
    granularity:"district",
    synthetic:true,
    displayWarning:"仅按虚构行政区着色，非六边形实测。"
  };
}

export function numericString(value,unit) {
  if(value===null||value===undefined||!Number.isFinite(value))return "暂无数据";
  const text=new Intl.NumberFormat("zh-CN",{
    maximumFractionDigits:2,minimumFractionDigits:0
  }).format(value);
  const suffix=unit==="persons"?"人":unit==="persons_per_km2"?"人/平方公里":unit==="index"?"（模拟指数）":unit;
  return text+(suffix?" "+suffix:"");
}

export function comparePeriods(earlier,later) {
  if(!earlier||!later)return {
    comparable:false,code:"NO_PAIR",label:"缺少同期可比的数据"
  };
  if(earlier.metric_id!==later.metric_id||
     earlier.geography_id!==later.geography_id||
     earlier.granularity!==later.granularity||
     earlier.unit!==later.unit) {
    return {comparable:false,code:"METRIC_DEFINITION_CHANGED",label:"指标、地区、单位或尺度不一致"};
  }
  if(earlier.period===later.period)
    return {comparable:false,code:"SAME_PERIOD",label:"不是跨年数据"};
  if(earlier.value===null||later.value===null||
     !Number.isFinite(earlier.value)||!Number.isFinite(later.value)) {
    return {comparable:false,code:"MISSING_VALUE",label:"至少一年的数据缺失，不能计算变化"};
  }
  if(earlier.status!==later.status||earlier.method_id!==later.method_id) {
    return {comparable:false,code:"METHOD_CHANGED",label:"数据状态或计算口径改变，禁止直接比较"};
  }
  if(earlier.status==="estimated"||earlier.status==="unavailable") {
    return {comparable:false,code:"NOT_DIRECTLY_COMPARABLE",label:"估算或缺失值不能直接排名或计算变化"};
  }
  const difference=later.value-earlier.value;
  const pct=earlier.value===0?null:difference/Math.abs(earlier.value)*100;
  return {
    comparable:true,code:"SYNTHETIC_DEMO_ONLY",
    label:"仅演示合成数据的跨年差值，非真实上海趋势",
    difference,percentage:pct
  };
}

export function traceMetric(bundle,metric) {
  if(!metric)return {status:"unavailable",statusLabel:"暂无数据",explanation:statusExplanation.unavailable,
                    source:null,method:null,unit:null,period:null,flags:[]};
  const source=bundle.sources.find(s=>s.id===metric.source_id);
  if(!source||source.license_status!=="synthetic")
    throw new Error("P08_MISSING_OR_UNAPPROVED_PROVENANCE");
  return {
    status:metric.status,
    statusLabel:statusLabel[metric.status]??"未知状态",
    explanation:statusExplanation[metric.status]??"未知口径",
    source:{
      id:source.id,title:source.title,publisher:source.publisher,
      url:source.url,license_status:source.license_status,
      reference_period:source.reference_period,
      native_granularity:source.native_granularity,
      redistribution_allowed:source.redistribution_allowed
    },
    method:metric.method_id??null,
    metric_id:metric.metric_id,region_id:metric.geography_id,
    granularity:metric.granularity,unit:metric.unit,period:metric.period,
    flags:[...metric.quality_flags]
  };
}

export function relatedZoneEstimates(bundle,districtId) {
  const zones=new Set(bundle.regions.filter(r=>r.kind==="zone"&&r.parent_id===districtId).map(r=>r.id));
  return bundle.metrics.filter(m=>m.granularity==="zone"&&zones.has(m.geography_id))
    .map(m=>({metric:m,trace:traceMetric(bundle,m)}));
}

export const SUPPORTED_PERIODS=P;
