/** P08 Almanac panel: safe textContent-only rendering of synthetic values. */
import {metricFor,comparePeriods,traceMetric,numericString,relatedZoneEstimates} from "../almanac.mjs";

const el=(tag,className="",value=null)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(value!==null)node.textContent=value;
  return node;
};
const addLabel=(host,label,value)=>{
  const row=el("div","provenance-row");
  row.append(el("span","",label),el("strong","",value));
  host.append(row);
};

export function renderLensLegend(host,view) {
  host.replaceChildren();
  if(!view){host.append(el("span","","暂无区级专题。"));return;}
  const tag=el("div","legend-heading",view.lens.title+" · "+view.period+" · "+view.lens.units_label);
  host.append(tag);
  for(const item of view.items){
    const row=el("div","legend-value");
    const swatch=el("span","lens-swatch");
    swatch.style.backgroundColor=item.color;
    const name=el("span","",item.name);
    const value=el("strong","",item.value===null?"暂无数据":numericString(item.value,item.metric?.unit));
    row.append(swatch,name,value);
    host.append(row);
  }
  host.append(el("p","legend-caption","合成的行政区级数值；未给六边形赋予实际统计。"));
}

export function renderAlmanac({
  bundles,year,lens,coverage,selected,regionFocus
},onFocus) {
  const summary=document.getElementById("almanac-summary");
  const regions=document.getElementById("almanac-regions");
  const comparison=document.getElementById("comparison-result");
  const sourceDetail=document.getElementById("source-detail");
  const zoneSection=document.getElementById("zone-estimate");
  regions.replaceChildren();
  sourceDetail.replaceChildren();
  zoneSection.replaceChildren();
  const bundle=bundles?.[year];
  if(!bundle||!coverage||selected===null||!lens) {
    summary.textContent=!lens?"请选择一个虚构区级专题，然后在地图上选中六边形。":
      "请选择六边形查看虚构区级指标及来源。";
    comparison.textContent="尚无选中指标的跨期对照。";
    sourceDetail.textContent="尚无可核验的合成统计来源。";
    zoneSection.textContent="没有选中行政区。";
    return;
  }
  const members=[...(coverage.byCell.get(selected)||[])].sort((a,b)=>b.fraction-a.fraction);
  if(!members.length){
    summary.textContent="当前六边形没有虚构行政区归属；无区级统计值。";
    comparison.textContent="没有行政区，不能计算差值。";
    sourceDetail.textContent="该单元只有合成几何，没有区级来源。";
    zoneSection.textContent="无区属估算指标。";
    return;
  }
  const known=new Set(members.map(m=>m.region_id));
  const focused=known.has(regionFocus)?regionFocus:members[0].region_id;
  summary.textContent="Cell #"+selected+" 跨越 "+members.length+" 个虚构区域；下列是完整区级数值，不是按覆盖比例分摊的格网值。";
  for(const member of members) {
    const reg=bundle.regions.find(r=>r.id===member.region_id);
    const metric=metricFor(bundle,lens.metric_id,member.region_id);
    const row=el("button","almanac-region"+(member.region_id===focused?" active":""));
    row.type="button";row.dataset.regionId=member.region_id;
    const label=el("span","",reg?.name_zh??member.region_id);
    const value=el("strong","",numericString(metric?.value??null,metric?.unit));
    const status=el("span","almanac-status",
      (metric?.status==="unavailable"||!metric)?"暂无数据":
      metric.status==="derived"?"模拟派生":metric.status==="estimated"?"模拟估算":"模拟观测");
    row.append(label,value,status);
    row.setAttribute("aria-pressed",String(member.region_id===focused));
    row.title="区属几何交集占 "+(member.fraction*100).toFixed(1)+"%，统计值不按此分摊";
    row.addEventListener("click",()=>onFocus(member.region_id));
    regions.append(row);
  }
  const chosen=metricFor(bundle,lens.metric_id,focused);
  const left=metricFor(bundles["2024"],lens.metric_id,focused);
  const right=metricFor(bundles["2025"],lens.metric_id,focused);
  const diff=comparePeriods(left,right);
  comparison.replaceChildren();
  comparison.append(el("span","comparison-label","2024 → 2025 · 仅合成演示"));
  if(diff.comparable){
    const unit=chosen?.unit??left.unit;
    const sign=diff.difference>0?"+":"";
    const exact=sign+numericString(diff.difference,unit);
    comparison.append(el("strong","comparison-delta",exact));
    const extra=diff.percentage===null?"基期为零，不能计算百分比":
      sign+diff.percentage.toFixed(2)+"%";
    comparison.append(el("span","comparison-pct",extra));
  }else comparison.append(el("strong","comparison-blocked",diff.label));
  comparison.append(el("small","",diff.label));

  if(!chosen) {
    sourceDetail.textContent="该区此统计期未提供此指标。缺失不等于零。";
  }else {
    const trace=traceMetric(bundle,chosen);
    addLabel(sourceDetail,"统计单位","虚构区级 district");
    addLabel(sourceDetail,"状态",trace.statusLabel);
    addLabel(sourceDetail,"指标 ID",trace.metric_id);
    addLabel(sourceDetail,"统计期",trace.period);
    addLabel(sourceDetail,"单位",trace.unit);
    addLabel(sourceDetail,"来源 ID",trace.source?.id??"缺失");
    addLabel(sourceDetail,"发布机构",trace.source?.publisher??"缺失");
    addLabel(sourceDetail,"来源标题",trace.source?.title??"缺失");
    addLabel(sourceDetail,"来源 URL",trace.source?.url??"缺失");
    addLabel(sourceDetail,"许可标记",trace.source?.license_status??"缺失");
    addLabel(sourceDetail,"原生空间粒度",trace.source?.native_granularity??"缺失");
    addLabel(sourceDetail,"计算方法",trace.method??"无（模拟直接观测或缺失）");
    addLabel(sourceDetail,"质量标记",trace.flags.length?trace.flags.join(", "):"无");
    sourceDetail.append(el("p","source-disclaimer",
      trace.explanation+" 以上 URL 是不可访问的 example.invalid 测试占位符，不是现实统计数据下载链接。"));
  }

  const estimated=relatedZoneEstimates(bundle,focused);
  if(!estimated.length){
    zoneSection.append(el("p","",year+" 年没有该区下属园区的合成估算。"));
  }else {
    for(const item of estimated){
      const area=bundle.regions.find(r=>r.id===item.metric.geography_id);
      const name=el("strong","",area?.name_zh??item.metric.geography_id);
      const value=el("div","zone-value",
        item.metric.metric_id+": "+numericString(item.metric.value,item.metric.unit));
      const method=el("p","",
        "状态：模拟估算 · 方法："+(item.trace.method??"缺失")+" · 质量："+item.trace.flags.join(", "));
      zoneSection.append(name,value,method);
    }
  }
}
