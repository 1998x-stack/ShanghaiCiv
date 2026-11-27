/**
 * P10 Explorer DOM and SVG. All displays remain visibly fictional district data.
 * SVG circles are district-level points, never measured individual map hexes.
 */
import {EXPLORER_METRICS,compareDistricts,scatterData} from "../explorer.mjs";
import {numericString} from "../almanac.mjs";
const el=(tag,cls="",value=null)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(value!==null)node.textContent=String(value);
  return node;
};
const svgEl=(tag,attrs={})=>{
  const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  return node;
};
function labelFor(metricId){return metricId==="population"?"虚构人口":"虚构人口密度";}
const fmt=(row,id)=>{
  const c=row.metrics[id];
  return c.value===null?"暂无数据":numericString(c.value,c.unit);
};
export function renderExplorerTable(host,view,selectedRegion,onSelect){
  const table=el("table","explorer-table");
  table.setAttribute("aria-label","虚构区级指标排序表");
  const head=el("thead");
  const header=el("tr");
  for(const text of ["虚构行政区","人口","密度"]){
    const th=el("th","",text);th.scope="col";header.append(th);
  }
  head.append(header);table.append(head);
  const body=el("tbody");
  for(const row of view.rows){
    const tr=el("tr",row.region_id===selectedRegion?"active":"");
    tr.dataset.regionId=row.region_id;
    const name=el("td");
    const button=el("button","explorer-pick",row.name);
    button.type="button";
    button.dataset.regionId=row.region_id;
    button.setAttribute("aria-pressed",String(row.region_id===selectedRegion));
    button.title="选择此虚构区，地图将聚焦到其合成格网";
    button.addEventListener("click",()=>onSelect(row.region_id));
    name.append(button);tr.append(name);
    for(const metricId of EXPLORER_METRICS){
      const cell=row.metrics[metricId];
      const td=el("td",cell.value===null?"explorer-null":"");
      const n=el("strong","",fmt(row,metricId));
      const state=el("small","explorer-status",
        cell.status==="observed"?"模拟观测":cell.status==="derived"?"模拟派生":
          cell.status==="estimated"?"模拟估算":"缺失");
      td.append(n,state);
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  host.replaceChildren(table);
}
export function renderExplorerScatter(host,view,selectedRegion,onSelect){
  host.replaceChildren();
  const data=scatterData(view);
  const svg=svgEl("svg",{
    viewBox:"0 0 300 220",role:"img",
    "aria-label":"虚构区级人口与人口密度散点图；缺失点不显示"
  });
  const W=300,H=220,left=54,right=286,top=17,bottom=168;
  const line=(x1,y1,x2,y2)=>{
    svg.append(svgEl("line",{x1,y1,x2,y2,stroke:"#718b8c","stroke-width":1}));
  };
  line(left,top,left,bottom);line(left,bottom,right,bottom);
  const xlab=svgEl("text",{x:164,y:208,fill:"#d2ded6","text-anchor":"middle","font-size":"11"});
  xlab.textContent="人口（人，虚构）";svg.append(xlab);
  const ylab=svgEl("text",{
    x:13,y:105,fill:"#d2ded6",transform:"rotate(-90 13 105)",
    "text-anchor":"middle","font-size":"11"
  });
  ylab.textContent="人口密度（人/平方公里）";svg.append(ylab);
  if(data.points.length){
    const xs=data.points.map(p=>p.x),ys=data.points.map(p=>p.y);
    const lowX=Math.min(...xs),highX=Math.max(...xs),lowY=Math.min(...ys),highY=Math.max(...ys);
    const spanX=Math.max(1,highX-lowX),spanY=Math.max(1,highY-lowY);
    for(const p of data.points){
      const x=left+13+(right-left-26)*(.5+(p.x-lowX-(spanX/2))/spanX)*.86;
      const y=bottom-13-(bottom-top-26)*(.5+(p.y-lowY-(spanY/2))/spanY)*.86;
      const group=svgEl("g",{tabindex:"0",role:"button",
        "aria-label":p.name+" 模拟人口 "+p.x+" 模拟密度 "+p.y,
        "data-region-id":p.region_id});
      const circle=svgEl("circle",{cx:x,cy:y,r:p.region_id===selectedRegion?8:6,
        fill:p.region_id===selectedRegion?"#f0d59b":"#91c4ae",
        stroke:"#f6f0da","stroke-width":1.5});
      group.append(circle);
      const title=svgEl("title");title.textContent=p.name+" · "+
        p.x+" 人 / "+p.y+" 人/平方公里";group.append(title);
      group.addEventListener("click",()=>onSelect(p.region_id));
      group.addEventListener("keydown",event=>{
        if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(p.region_id);}
      });
      svg.append(group);
    }
  }
  host.append(svg);
  host.append(el("p","explorer-scatter-note",
    data.warning+" 完整样本点 "+data.points.length+"，缺失点 "+data.omitted.length+"。"));
}
export function renderExplorerCompare(host,view,leftId,rightId,metricId){
  const comparison=compareDistricts(view,leftId,rightId,metricId);
  host.replaceChildren();
  if(!comparison.comparable){
    host.append(el("strong","explorer-blocked",comparison.message));
    host.append(el("small","",comparison.code));
    return comparison;
  }
  host.append(el("strong","explorer-diff",
    "差值（左 − 右）："+comparison.diffText));
  host.append(el("p","",comparison.leftText+" vs "+comparison.rightText+
    " · "+view.period+" 年 · "+labelFor(metricId)));
  host.append(el("small","",comparison.message));
  return comparison;
}
export function renderExplorerAudit(host,view,regionId,metricId){
  host.replaceChildren();
  const row=view.rows.find(r=>r.region_id===regionId);
  if(!row){
    host.append(el("p","","选中虚构区域后显示来源、口径与许可。"));
    return;
  }
  const c=row.metrics[metricId];
  for(const [key,value] of [
    ["选中区域",row.name],["指标",labelFor(metricId)],["年份",view.period],
    ["原生空间粒度",c.granularity],["统计单位",c.unit??"未给出"],
    ["值状态",c.status],["计算方法",c.method_id??"未给出"],
    ["来源 ID",c.source_id??"缺失"],["来源机构",c.publisher??"缺失"],
    ["来源统计期",c.source_period??"未给出"],["数据许可",c.license_status??"缺失"],
    ["质量标记",c.quality_flags.length?c.quality_flags.join(", "):"无"]]){
    const rowEl=el("div","explorer-audit-row");
    rowEl.append(el("span","",key),el("strong","",value));host.append(rowEl);
  }
  host.append(el("p","explorer-audit-warning",
    "来源 URL 为 example.invalid 合成占位符，不是官方统计网站。真实地图和统计再分发仍为 BLOCKED。"));
}
