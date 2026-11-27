import {Camera} from "../camera.mjs";
import {assertSyntheticScene,buildSyntheticCoverage,geometryBounds} from "../synthetic-spatial.mjs";
import {renderBase,renderOverlay,drawScalebar} from "../render/synthetic-canvas.mjs";

const $=id=>document.getElementById(id);
const root=$("app"),viewport=$("map-viewport");
const baseCanvas=$("map-base"),overlayCanvas=$("map-interaction");
const baseCtx=baseCanvas.getContext("2d"),overlayCtx=overlayCanvas.getContext("2d");
const camera=new Camera();
const layers={terrain:true,grid:true,districts:true,partial:true};
const sceneUrl=new URL("../../../tests/fixtures/synthetic/synthetic_gis_scene.json",import.meta.url);
let scene=null,coverage=null,selected=null,hovered=null,drag=null;
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
  history.replaceState(null,"",location.pathname+location.search+"#"+p.toString());
}
function restoreHash() {
  const p=new URLSearchParams(location.hash.replace(/^#/,""));
  if(p.has("x")&&p.has("y")&&p.has("z"))
    camera.restore({x:Number(p.get("x")),y:Number(p.get("y")),z:Number(p.get("z"))});
  const id=p.get("cell");
  if(id!==null&&/^\d+$/.test(id)) {
    const n=Number(id);
    if(Number.isSafeInteger(n)&&n<coverage.grid.size)selected=n;
  }
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
}
function draw() {
  scheduled=false;
  if(!coverage)return;
  const start=performance.now();
  if(baseDirty) {
    visibleCells=renderBase(baseCtx,camera,coverage,scene,layers).visibleCells;
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
    restoreHash();updateInspector();schedule(true);
  });
  new ResizeObserver(resize).observe(viewport);
}
async function main() {
  wireControls();resize();
  try {
    const response=await fetch(sceneUrl,{cache:"no-store",credentials:"omit"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    scene=assertSyntheticScene(await response.json());
    coverage=buildSyntheticCoverage(scene);
    for(const region of scene.regions) {
      const option=document.createElement("option");
      option.value=region.id;option.textContent=region.name_zh;
      $("region-search").append(option);
    }
    fitScene(false);
    restoreHash();updateInspector();schedule(true);
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
