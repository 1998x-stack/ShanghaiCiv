import {Camera} from "../camera.mjs";
import {assertSyntheticScene,buildSyntheticCoverage,geometryBounds} from "../synthetic-spatial.mjs";
import {renderBase,renderOverlay,drawScalebar} from "../render/synthetic-canvas.mjs";
import {assertSyntheticData,lensCatalog,districtMetricsView,SUPPORTED_PERIODS} from "../almanac.mjs";
import {renderLensLegend,renderAlmanac} from "./almanac-ui.mjs";
import {createArtSession} from "../render/art/art-layer.mjs";
import {SYNTHETIC_ZONES,assertSyntheticZones} from "../render/art/zones.mjs";
import {LOD_LEVELS} from "../render/art/lod.mjs";
import {buildExplorerView,syntheticCSV,EXPLORER_METRICS} from "../explorer.mjs";
import {renderExplorerTable,renderExplorerScatter,renderExplorerCompare,renderExplorerAudit} from "./explorer-ui.mjs";

const $=id=>document.getElementById(id);
const root=$("app"),viewport=$("map-viewport");
const baseCanvas=$("map-base"),overlayCanvas=$("map-interaction");
const baseCtx=baseCanvas.getContext("2d"),overlayCtx=overlayCanvas.getContext("2d");
const camera=new Camera();
const layers={terrain:true,grid:true,districts:true,partial:true};
const artSession=createArtSession(160);
const artOptions={decorations:true,zones:true,lodOverride:"auto"};
const sceneUrl=new URL("../../../tests/fixtures/synthetic/synthetic_gis_scene.json",import.meta.url);
const vintageUrls=Object.fromEntries(SUPPORTED_PERIODS.map(year=>[
  year,new URL("../../../tests/fixtures/synthetic/synthetic_"+year+".json",import.meta.url)
]));
let scene=null,coverage=null,selected=null,hovered=null,drag=null;
let bundles=null,activeYear="2024",activeLens="lens-population",regionFocus=null;
let explorerSort="population",explorerDirection="desc";
let explorerLeft=null,explorerRight=null,explorerCompareMetric="population";
function explorerView(){
  return bundles&&scene?
    buildExplorerView(bundles,scene,activeYear,explorerSort,explorerDirection):null;
}
function selectedExplorerRegion(){
  if(selected===null||!coverage)return null;
  const members=[...(coverage.byCell.get(selected)||[])].sort((a,b)=>b.fraction-a.fraction);
  return members.find(m=>m.region_id===regionFocus)?.region_id??members[0]?.region_id??null;
}
function focusExplorerRegion(regionId){
  if(!scene?.regions.some(r=>r.id===regionId)||!coverage)return;
  const candidates=coverage.memberships
    .filter(m=>m.region_id===regionId)
    .sort((a,b)=>b.fraction-a.fraction||a.cell_id-b.cell_id);
  if(!candidates.length)return;
  const id=candidates[0].cell_id;
  const [col,row]=coverage.grid.colRow(id);
  const [x,y]=coverage.grid.center(col,row);
  selected=id;regionFocus=regionId;
  camera.centerX=x;camera.centerY=y;
  camera.scale=Math.min(camera.maxScale,Math.max(camera.minScale,.16));
  updateInspector();schedule(true);saveHash();
}
function refreshExplorer(){
  const view=explorerView();
  if(!view)return;
  const focus=selectedExplorerRegion();
  $("explorer-year").textContent="与左侧专题同步："+view.period+" 年（虚构数据）";
  renderExplorerTable($("explorer-rank"),view,focus,focusExplorerRegion);
  renderExplorerScatter($("explorer-scatter"),view,focus,focusExplorerRegion);
  renderExplorerCompare($("explorer-comparison"),view,explorerLeft,explorerRight,explorerCompareMetric);
  renderExplorerAudit($("explorer-audit"),view,focus??explorerLeft,explorerCompareMetric);
  $("explorer-counts").textContent="可排序 "+view.completeCount+" 个区 · "+
    "缺失 "+view.missingCount+" 个区 · 缺失值置末，不记为 0";
}
function currentLensView() {
  if(!bundles||!scene||activeLens==="none")return null;
  const lens=lensCatalog(bundles).find(l=>l.id===activeLens);
  return lens?districtMetricsView(bundles[activeYear],lens,scene):null;
}
function refreshThematic() {
  renderLensLegend($("lens-legend"),currentLensView());
  const view=currentLensView();
  $("lens-notice").textContent=view?
    "区级区域着色 · "+view.observedCount+" 项有值 / "+
    view.missingCount+" 项缺失。不是六边形实测。":
    "关闭专题着色；仍可查看虚构几何覆盖。";
  schedule(true);updateInspector();
}
let scheduled=false,baseDirty=true,pinchDistance=null;
let visibleCells=0;
const activePointers=new Map();

function status(message,isError=false) {
  $("load-state").textContent=message;
  $("load-state").classList.toggle("error",isError);
}
const pct=v=>(v*100).toFixed(1)+"%";

function saveHash() {
  if(!scene)return;
  const p=new URLSearchParams(),s=camera.toState();
  p.set("x",s.x.toFixed(3));p.set("y",s.y.toFixed(3));p.set("z",s.z.toFixed(6));
  if(selected!==null)p.set("cell",String(selected));
  p.set("layers",Object.keys(layers).filter(k=>layers[k]).join(","));
  p.set("year",activeYear);
  p.set("lens",activeLens);
  p.set("art",artOptions.decorations?"1":"0");
  p.set("zones",artOptions.zones?"1":"0");
  p.set("lod",artOptions.lodOverride);
  p.set("sort",explorerSort);p.set("order",explorerDirection);
  p.set("left",explorerLeft??"");p.set("right",explorerRight??"");
  p.set("compare",explorerCompareMetric);
  if(regionFocus)p.set("focus",regionFocus);
  history.replaceState(null,"",location.pathname+location.search+"#"+p.toString());
}
function restoreHash() {
  const p=new URLSearchParams(location.hash.replace(/^#/,""));
  if(p.has("x")&&p.has("y")&&p.has("z"))
    camera.restore({x:Number(p.get("x")),y:Number(p.get("y")),z:Number(p.get("z"))});
  if(SUPPORTED_PERIODS.includes(p.get("year")))activeYear=p.get("year");
  const requestedLens=p.get("lens");
  if(requestedLens==="none"||lensCatalog(bundles).some(l=>l.id===requestedLens))
    activeLens=requestedLens;
  $("metric-year").value=activeYear;
  $("metric-lens").value=activeLens;
  const id=p.get("cell");
  if(id!==null&&/^\d+$/.test(id)) {
    const n=Number(id);
    if(Number.isSafeInteger(n)&&n<coverage.grid.size)selected=n;
  }
  if(["0","1"].includes(p.get("art")))artOptions.decorations=p.get("art")==="1";
  if(["0","1"].includes(p.get("zones")))artOptions.zones=p.get("zones")==="1";
  if(p.get("lod")==="auto"||LOD_LEVELS.includes(p.get("lod")))artOptions.lodOverride=p.get("lod");
  $("art-decorations").checked=artOptions.decorations;
  $("art-zones").checked=artOptions.zones;
  $("art-lod").value=artOptions.lodOverride;
  if(EXPLORER_METRICS.includes(p.get("sort")))explorerSort=p.get("sort");
  if(["asc","desc"].includes(p.get("order")))explorerDirection=p.get("order");
  if(EXPLORER_METRICS.includes(p.get("compare")))explorerCompareMetric=p.get("compare");
  const ids=new Set(scene.regions.map(x=>x.id));
  if(ids.has(p.get("left")))explorerLeft=p.get("left");
  if(ids.has(p.get("right")))explorerRight=p.get("right");
  if(ids.has(p.get("focus"))&&selected!==null&&
     (coverage.byCell.get(selected)||[]).some(m=>m.region_id===p.get("focus")))
    regionFocus=p.get("focus");
  $("explorer-sort").value=explorerSort;
  $("explorer-direction").value=explorerDirection;
  $("explorer-left").value=explorerLeft;
  $("explorer-right").value=explorerRight;
  $("explorer-compare-metric").value=explorerCompareMetric;
  if(p.has("layers")) {
    const enabled=new Set(p.get("layers").split(","));
    for(const key of Object.keys(layers)) {
      layers[key]=enabled.has(key);
      $("layer-"+key).checked=layers[key];
    }
  }
}
function tag(label,extra="") {
  const node=document.createElement("span");
  node.className=("tag "+extra).trim();
  node.textContent=label;return node;
}
function updateInspector() {
  if(!coverage||selected===null) {
    $("cell-id").textContent="—";
    for(const key of ["land","water","outside"]) {
      $(key+"-value").textContent="—";
      $(key+"-bar").style.width="0%";
    }
    $("membership-list").textContent="尚未选择单元。";
    $("cell-tags").replaceChildren(tag("Synthetic"));
    if(bundles)renderAlmanac({bundles,year:activeYear,
      lens:currentLensView()?.lens??null,scene,coverage,selected,regionFocus},
      id=>{regionFocus=id;updateInspector();saveHash();});
    refreshExplorer();
    return;
  }
  const cell=coverage.cells[selected];
  $("cell-id").textContent="#"+String(selected).padStart(3,"0");
  for(const key of ["land","water","outside"]) {
    const value=cell[key+"_fraction"];
    $(key+"-value").textContent=pct(value);
    $(key+"-bar").style.width=String(Math.max(0,Math.min(100,value*100)))+"%";
  }
  const members=coverage.byCell.get(selected)||[];
  const views=members.length?members.map(m=>{
    const row=document.createElement("div");row.className="member-row";
    const name=document.createElement("span");
    name.textContent=scene.regions.find(r=>r.id===m.region_id)?.name_zh||m.region_id;
    const amount=document.createElement("strong");amount.textContent=pct(m.fraction);
    row.append(name,amount);return row;
  }):[document.createTextNode("未归属任何虚构行政区。")];
  $("membership-list").replaceChildren(...views);
  const labels=[tag("Synthetic")];
  if(cell.partial_cell)labels.push(tag("跨界混合格","warning"));
  if(cell.water_fraction>.05)labels.push(tag("含虚构水域"));
  if(cell.land_fraction>.05)labels.push(tag("含虚构陆地"));
  $("cell-tags").replaceChildren(...labels);
  if(bundles)renderAlmanac({bundles,year:activeYear,
    lens:currentLensView()?.lens??null,scene,coverage,selected,regionFocus},
    id=>{regionFocus=id;updateInspector();saveHash();});
  refreshExplorer();
}
function draw() {
  scheduled=false;
  if(!coverage)return;
  const start=performance.now();
  if(baseDirty) {
    const baseResult=renderBase(baseCtx,camera,coverage,scene,layers,currentLensView(),
      {session:artSession,options:artOptions});
    visibleCells=baseResult.visibleCells;
    const art=baseResult.art;
    if(art)$("art-state").textContent="LOD "+art.lod+
      " · 装饰 "+art.props+" · 标签 "+art.labels+
      " · 缓存 "+art.cache.entries+"/"+art.cache.limit+
      "（命中 "+art.cache.hits+" / 未命中 "+art.cache.misses+" / 淘汰 "+art.cache.evictions+"）";
    baseDirty=false;
  }
  renderOverlay(overlayCtx,camera,coverage,{hovered,selected});
  drawScalebar(overlayCtx,camera);
  $("perf-line").textContent="可见格 "+visibleCells+" / "+coverage.grid.size+
    " · 绘制 "+(performance.now()-start).toFixed(1)+" ms";
  $("camera-line").textContent="缩放 "+(camera.scale*100).toFixed(1)+"% · 本地虚构米制坐标";
}
function schedule(base=false) {
  if(base)baseDirty=true;
  if(!scheduled) {scheduled=true;requestAnimationFrame(draw);}
}
function resize() {
  const rect=viewport.getBoundingClientRect();
  const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
  camera.resize(width,height);
  const dpr=Math.min(3,Math.max(1,devicePixelRatio||1));
  for(const [canvas,ctx] of [[baseCanvas,baseCtx],[overlayCanvas,overlayCtx]]) {
    canvas.width=Math.round(width*dpr);
    canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  schedule(true);
}
function selectCell(id) {
  if(!coverage)return;
  selected=Number.isInteger(id)&&id>=0&&id<coverage.grid.size?id:null;
  regionFocus=null;
  updateInspector();schedule();saveHash();
}
function canvasPoint(event) {
  const rect=overlayCanvas.getBoundingClientRect();
  return [event.clientX-rect.left,event.clientY-rect.top];
}
function hit(x,y) {
  return coverage?coverage.grid.cellAt(...camera.screenToWorld(x,y)):-1;
}
function pointerDown(event) {
  if(!coverage)return;
  overlayCanvas.focus({preventScroll:true});
  overlayCanvas.setPointerCapture(event.pointerId);
  const [x,y]=canvasPoint(event);
  activePointers.set(event.pointerId,[x,y]);
  if(activePointers.size===1)drag={id:event.pointerId,x,y,lastX:x,lastY:y,moved:false};
  if(activePointers.size===2) {
    const pts=[...activePointers.values()];
    pinchDistance=Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1]);
    if(drag)drag.moved=true;
  }
}
function pointerMove(event) {
  if(!coverage)return;
  const [x,y]=canvasPoint(event);
  if(activePointers.has(event.pointerId)) {
    activePointers.set(event.pointerId,[x,y]);
    if(activePointers.size===2) {
      const pts=[...activePointers.values()];
      const d=Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1]);
      if(pinchDistance&&d>0) {
        camera.zoomAt((pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2,d/pinchDistance);
        schedule(true);
      }
      pinchDistance=d;
      if(drag)drag.moved=true;
      return;
    }
    if(drag&&drag.id===event.pointerId) {
      if(Math.abs(x-drag.x)+Math.abs(y-drag.y)>6)drag.moved=true;
      if(drag.moved) {camera.panPixels(x-drag.lastX,y-drag.lastY);schedule(true);}
      drag.lastX=x;drag.lastY=y;return;
    }
  }
  const next=hit(x,y);
  if(next!==hovered) {hovered=next;schedule();}
}
function pointerUp(event) {
  if(!coverage)return;
  const [x,y]=canvasPoint(event);
  if(activePointers.has(event.pointerId))activePointers.delete(event.pointerId);
  const clicked=drag&&drag.id===event.pointerId&&!drag.moved&&activePointers.size===0;
  if(clicked)selectCell(hit(x,y));
  if(!activePointers.size)pinchDistance=null;
  if(drag?.id===event.pointerId)drag=null;
  if(!activePointers.size)saveHash();
}
function handleKey(event) {
  if(!coverage)return;
  const distance=event.shiftKey?110:38;
  let handled=true;
  switch(event.key) {
    case "ArrowLeft":camera.panPixels(distance,0);break;
    case "ArrowRight":camera.panPixels(-distance,0);break;
    case "ArrowUp":camera.panPixels(0,distance);break;
    case "ArrowDown":camera.panPixels(0,-distance);break;
    case "+":case "=":camera.zoomAt(camera.width/2,camera.height/2,1.25);break;
    case "-":camera.zoomAt(camera.width/2,camera.height/2,.8);break;
    case "Enter":selectCell(hit(camera.width/2,camera.height/2));break;
    default:handled=false;
  }
  if(handled) {event.preventDefault();schedule(true);saveHash();}
}
function sceneBounds(features) {
  const boxes=features.map(f=>geometryBounds(f.geometry));
  return [
    Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),
    Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))
  ];
}
function fitScene(persist=true) {
  if(!scene)return;
  camera.fitBounds(sceneBounds([...scene.regions,...scene.surfaces]),
                   Math.min(64,camera.width*.085));
  schedule(true);
  if(persist)saveHash();
}
function wireControls() {
  $("zoom-in").addEventListener("click",()=>{
    if(!coverage)return;
    camera.zoomAt(camera.width/2,camera.height/2,1.3);schedule(true);saveHash();
  });
  $("zoom-out").addEventListener("click",()=>{
    if(!coverage)return;
    camera.zoomAt(camera.width/2,camera.height/2,1/1.3);schedule(true);saveHash();
  });
  $("reset-view").addEventListener("click",()=>{fitScene();selectCell(-1);});
  $("copy-link").addEventListener("click",async()=>{
    saveHash();
    try {await navigator.clipboard.writeText(location.href);status("视角链接已复制");}
    catch {status("请手动复制地址栏的视角链接");}
  });
  for(const key of Object.keys(layers)) {
    $("layer-"+key).addEventListener("change",event=>{
      layers[key]=event.target.checked;schedule(true);saveHash();
    });
  }
  $("art-decorations").addEventListener("change",event=>{
    artOptions.decorations=event.target.checked;schedule(true);saveHash();
  });
  $("art-zones").addEventListener("change",event=>{
    artOptions.zones=event.target.checked;schedule(true);saveHash();
  });
  $("art-lod").addEventListener("change",event=>{
    const value=event.target.value;
    if(value!=="auto"&&!LOD_LEVELS.includes(value))return;
    artOptions.lodOverride=value;schedule(true);saveHash();
  });
  $("art-zone").addEventListener("change",event=>{
    const zone=SYNTHETIC_ZONES.find(z=>z.id===event.target.value);
    if(!zone)return;
    camera.centerX=zone.x;camera.centerY=zone.y;
    camera.scale=Math.max(camera.minScale,Math.min(camera.maxScale,.20));
    schedule(true);saveHash();
  });
  $("explorer-sort").addEventListener("change",event=>{
    if(!EXPLORER_METRICS.includes(event.target.value))return;
    explorerSort=event.target.value;refreshExplorer();saveHash();
  });
  $("explorer-direction").addEventListener("change",event=>{
    if(!["asc","desc"].includes(event.target.value))return;
    explorerDirection=event.target.value;refreshExplorer();saveHash();
  });
  $("explorer-compare-metric").addEventListener("change",event=>{
    if(!EXPLORER_METRICS.includes(event.target.value))return;
    explorerCompareMetric=event.target.value;refreshExplorer();saveHash();
  });
  for(const [key,side] of [["explorer-left","left"],["explorer-right","right"]]){
    $(key).addEventListener("change",event=>{
      if(!scene?.regions.some(r=>r.id===event.target.value))return;
      if(side==="left")explorerLeft=event.target.value;else explorerRight=event.target.value;
      refreshExplorer();saveHash();
    });
  }
  $("explorer-download").addEventListener("click",()=>{
    const view=explorerView();
    if(!view)return;
    try{
      // Production CSV is explicitly forbidden; synthetic_test is the only allowed mode.
      const csv=syntheticCSV(view,"synthetic_test");
      const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a");
      link.href=url;link.download="SYNTHETIC-ONLY-explorer-"+view.period+".csv";
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      $("explorer-download-status").textContent=
        "已导出含来源与警示的合成样本 CSV；正式上海统计导出仍 BLOCKED。";
    }catch(error){
      $("explorer-download-status").textContent="导出被阻止："+error.message;
    }
  });
  $("metric-lens").addEventListener("change",event=>{
    activeLens=event.target.value;
    if(activeLens!=="none"&&!lensCatalog(bundles).some(l=>l.id===activeLens))
      activeLens="none";
    refreshThematic();saveHash();
  });
  $("metric-year").addEventListener("change",event=>{
    if(!SUPPORTED_PERIODS.includes(event.target.value))return;
    activeYear=event.target.value;
    refreshThematic();saveHash();
  });
  $("region-search").addEventListener("change",event=>{
    const feature=scene?.regions.find(f=>f.id===event.target.value);
    if(!feature) {fitScene();return;}
    camera.fitBounds(geometryBounds(feature.geometry),Math.min(70,camera.width*.12));
    schedule(true);saveHash();
  });
  overlayCanvas.addEventListener("pointerdown",pointerDown);
  overlayCanvas.addEventListener("pointermove",pointerMove);
  overlayCanvas.addEventListener("pointerup",pointerUp);
  overlayCanvas.addEventListener("pointercancel",pointerUp);
  overlayCanvas.addEventListener("pointerleave",()=>{
    if(!drag&&hovered!==null) {hovered=null;schedule();}
  });
  overlayCanvas.addEventListener("wheel",event=>{
    if(!coverage)return;
    event.preventDefault();
    const [x,y]=canvasPoint(event);
    camera.zoomAt(x,y,Math.exp(-Math.max(-400,Math.min(400,event.deltaY))*.0014));
    schedule(true);saveHash();
  },{passive:false});
  overlayCanvas.addEventListener("keydown",handleKey);
  window.addEventListener("hashchange",()=>{
    if(!coverage)return;
    restoreHash();refreshThematic();schedule(true);
  });
  new ResizeObserver(resize).observe(viewport);
}
async function main() {
  wireControls();resize();
  try {
    const urls=[sceneUrl,...SUPPORTED_PERIODS.map(year=>vintageUrls[year])];
    const responses=await Promise.all(urls.map(url=>fetch(url,{cache:"no-store",credentials:"omit"})));
    for(const response of responses)if(!response.ok)throw new Error("HTTP "+response.status);
    const [sceneJson,...bundleJsons]=await Promise.all(responses.map(response=>response.json()));
    scene=assertSyntheticScene(sceneJson);
    bundles=assertSyntheticData(Object.fromEntries(
      SUPPORTED_PERIODS.map((period,i)=>[period,bundleJsons[i]])
    ),scene);
    for(const lens of lensCatalog(bundles)) {
      const option=document.createElement("option");
      option.value=lens.id;option.textContent=lens.title+" · 区级";
      $("metric-lens").append(option);
    }
    $("metric-lens").value=activeLens;
    const response=responses[0];
    if(!response.ok)throw new Error("HTTP "+response.status);
    coverage=buildSyntheticCoverage(scene);
    assertSyntheticZones(scene);
    for(const zone of SYNTHETIC_ZONES){
      const option=document.createElement("option");
      option.value=zone.id;option.textContent=zone.label+"（"+zone.description+"）";
      $("art-zone").append(option);
    }
    for(const region of scene.regions) {
      const option=document.createElement("option");
      option.value=region.id;option.textContent=region.name_zh;
      $("region-search").append(option);
      for(const key of ["explorer-left","explorer-right"]){
        const clone=document.createElement("option");
        clone.value=region.id;clone.textContent=region.name_zh;
        $(key).append(clone);
      }
    }
    explorerLeft=scene.regions[0]?.id??null;
    explorerRight=scene.regions[1]?.id??null;
    fitScene(false);
    restoreHash();refreshThematic();schedule(true);
    root.dataset.ready="true";
    status("已载入 "+coverage.grid.size+" 个虚构格网单元");
  } catch(error) {
    root.dataset.ready="error";
    $("error-banner").hidden=false;
    $("error-detail").textContent="无法载入虚构测试场景："+error.message+
      "。请检查本地 HTTP 服务或文件路径。";
    status("合成地图加载失败",true);
  }
}
void main();
