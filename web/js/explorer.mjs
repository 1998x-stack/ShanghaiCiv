/**
 * P10 district-only Explorer contracts. Everything here is a fictional demo.
 * No map hex population, real Shanghai data, real coordinates or real exports.
 */
import {assertSyntheticData,lensCatalog,metricFor,numericString} from "./almanac.mjs";

export const EXPLORER_METRICS=Object.freeze(["population","population_density"]);
export const EXPLORER_PERIODS=Object.freeze(["2024","2025"]);

function metricCell(bundle,metricId,regionId){
  const metric=metricFor(bundle,metricId,regionId);
  const source=metric?bundle.sources.find(s=>s.id===metric.source_id):null;
  if(metric && (!source||source.license_status!=="synthetic"))
    throw new Error("EXPLORER_SOURCE_NOT_SYNTHETIC");
  if(metric && (metric.granularity!=="district"||metric.period!==bundle.release.data_vintage))
    throw new Error("EXPLORER_INVALID_METRIC_GRAIN");
  return {
    value:metric?.value??null,
    unit:metric?.unit??null,
    status:metric?.status??"unavailable",
    source_id:source?.id??null,source_title:source?.title??null,
    publisher:source?.publisher??null,source_url:source?.url??null,
    source_period:source?.reference_period??null,
    license_status:source?.license_status??null,
    redistribution_allowed:source?.redistribution_allowed===true,
    method_id:metric?.method_id??null,
    quality_flags:metric?.quality_flags??[],
    granularity:"district"
  };
}
export function buildExplorerView(bundles,scene,period,sortMetric="population",direction="desc"){
  assertSyntheticData(bundles,scene);
  if(!EXPLORER_PERIODS.includes(period))throw new RangeError("EXPLORER_INVALID_PERIOD");
  if(!EXPLORER_METRICS.includes(sortMetric))throw new RangeError("EXPLORER_INVALID_SORT");
  if(!["asc","desc"].includes(direction))throw new RangeError("EXPLORER_INVALID_SORT_DIRECTION");
  const bundle=bundles[period],metricCatalog=lensCatalog(bundles);
  const metrics=Object.fromEntries(metricCatalog.filter(l=>EXPLORER_METRICS.includes(l.metric_id))
    .map(l=>[l.metric_id,{label:l.title,units_label:l.units_label,id:l.metric_id}]));
  if(Object.keys(metrics).length!==EXPLORER_METRICS.length)
    throw new Error("EXPLORER_MISSING_METRIC_DEFINITION");
  const rows=scene.regions.map(region=>({
    region_id:region.id,name:region.name_zh,period,
    metrics:Object.fromEntries(EXPLORER_METRICS.map(id=>
      [id,metricCell(bundle,id,region.id)]))
  }));
  if(new Set(rows.map(x=>x.region_id)).size!==rows.length)
    throw new Error("EXPLORER_DUPLICATE_REGION");
  const multiplier=direction==="asc"?1:-1;
  rows.sort((a,b)=>{
    const x=a.metrics[sortMetric].value,y=b.metrics[sortMetric].value;
    if(x===null && y!==null)return 1;
    if(y===null && x!==null)return -1;
    if(x!==null&&y!==null&&x!==y)return (x-y)*multiplier;
    return a.region_id.localeCompare(b.region_id);
  });
  const values=rows.filter(r=>r.metrics[sortMetric].value!==null);
  return {
    schema_version:1,synthetic:true,publish_approved:false,
    period,sortMetric,direction,metrics,rows,
    completeCount:values.length,missingCount:rows.length-values.length,
    note:"所有数字均为人工虚构的行政区级测试数据，不是上海真实人口或经济指标。"
  };
}
export function compareDistricts(view,leftId,rightId,metricId){
  if(!EXPLORER_METRICS.includes(metricId))throw new RangeError("EXPLORER_INVALID_COMPARE_METRIC");
  if(leftId===rightId)return {comparable:false,code:"SAME_DISTRICT",message:"请选择不同的虚构行政区"};
  const left=view.rows.find(x=>x.region_id===leftId);
  const right=view.rows.find(x=>x.region_id===rightId);
  if(!left||!right)return {comparable:false,code:"MISSING_REGION",message:"区域 ID 无法匹配"};
  const a=left.metrics[metricId],b=right.metrics[metricId];
  if(a.value===null||b.value===null)
    return {comparable:false,code:"MISSING_VALUE",message:"缺失值不可比较，也不能当作零"};
  if(a.unit!==b.unit||a.granularity!==b.granularity||
     a.status!==b.status||a.method_id!==b.method_id||
     a.source_period!==b.source_period||a.license_status!==b.license_status)
    return {comparable:false,code:"INCOMPATIBLE_DEFINITION",message:"统计单位、方法、来源期或状态不兼容"};
  if(a.status==="estimated"||b.status==="estimated")
    return {comparable:false,code:"ESTIMATE_NOT_COMPARABLE",message:"模拟估计不参与直接对比"};
  return {comparable:true,code:"SYNTHETIC_DEMO_ONLY",
    message:"同一期、同单位、同方法的合成区级指标示例；非真实上海差异",
    period:view.period,metricId,left:leftId,right:rightId,
    difference:a.value-b.value,
    leftText:numericString(a.value,a.unit),rightText:numericString(b.value,b.unit),
    diffText:numericString(a.value-b.value,a.unit)};
}
export function scatterData(view,xMetric="population",yMetric="population_density"){
  if(!EXPLORER_METRICS.includes(xMetric)||!EXPLORER_METRICS.includes(yMetric))
    throw new RangeError("EXPLORER_INVALID_SCATTER_METRIC");
  if(xMetric===yMetric)throw new RangeError("EXPLORER_DUPLICATE_AXIS");
  const points=[],omitted=[];
  for(const row of view.rows){
    const x=row.metrics[xMetric],y=row.metrics[yMetric];
    if(x.value===null||y.value===null||!Number.isFinite(x.value)||!Number.isFinite(y.value)||
       ["estimated","unavailable"].includes(x.status)||["estimated","unavailable"].includes(y.status)){
      omitted.push(row.region_id);continue;
    }
    points.push({region_id:row.region_id,name:row.name,x:x.value,y:y.value,
      xUnit:x.unit,yUnit:y.unit});
  }
  return {points,omitted,xMetric,yMetric,period:view.period,synthetic:true,
    correlationAllowed:false,warning:"合成测试样本量极少，不计算相关性或回归。缺失区不绘制成零点。"};
}
const csvField=value=>{
  let s=value===null||value===undefined?"":String(value);
  // Spreadsheet formula injection protection for imported arbitrary metadata.
  if(/^[\s]*[=+@-]/.test(s)&&!/^-\d+(\.\d+)?$/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
};
export function syntheticCSV(view,mode="synthetic_test"){
  if(mode!=="synthetic_test"||view?.synthetic!==true||view.publish_approved!==false)
    throw new Error("EXPLORER_PRODUCTION_EXPORT_BLOCKED");
  if(!EXPLORER_PERIODS.includes(view.period)||!Array.isArray(view.rows))
    throw new Error("EXPLORER_INVALID_EXPORT_VIEW");
  const cols=["synthetic_disclosure","reference_period","region_id","region_name",
    "granularity","metric_id","value","unit","status","source_id","source_title",
    "publisher","source_url","source_period","method_id","quality_flags",
    "license_status","redistribution_allowed","publish_approved"];
  const data=[["# SYNTHETIC TEST ONLY - NOT REAL SHANGHAI DATA - NOT APPROVED FOR PRODUCTION REDISTRIBUTION"],
    cols];
  for(const row of view.rows){
    for(const id of EXPLORER_METRICS){
      const cell=row.metrics?.[id];
      if(!cell||cell.license_status!=="synthetic"||cell.redistribution_allowed!==true||
         cell.granularity!=="district")throw new Error("EXPLORER_EXPORT_SOURCE_UNAPPROVED");
      data.push(["FICTIONAL_FIXTURE",row.period,row.region_id,row.name,"district",
        id,cell.value,cell.unit,cell.status,cell.source_id,cell.source_title,
        cell.publisher,cell.source_url,cell.source_period,cell.method_id,
        cell.quality_flags.join("|"),cell.license_status,
        String(cell.redistribution_allowed),"false"]);
    }
  }
  return "\uFEFF"+data.map(row=>row.map(csvField).join(",")).join("\r\n")+"\r\n";
}
