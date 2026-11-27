import {Camera} from "../camera.mjs";
import {assertSyntheticScene,buildSyntheticCoverage} from "../synthetic-spatial.mjs";
import {renderBase} from "../render/synthetic-canvas.mjs";
import {createArtSession} from "../render/art/art-layer.mjs";
import {LOD_LEVELS} from "../render/art/lod.mjs";

const fixtureUrl=new URL("../../../tests/fixtures/synthetic/synthetic_gis_scene.json",import.meta.url);
const scales={overview:.03,regional:.07,local:.14,detail:.25};
const session=createArtSession(160);
let coverage=null,scene=null;

function renderPanel(lod){
  const canvas=document.getElementById("art-"+lod);
  const rect=canvas.getBoundingClientRect();
  const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
  const dpr=Math.min(2,Math.max(1,devicePixelRatio||1));
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const camera=new Camera();camera.resize(width,height);
  camera.centerX=2200;camera.centerY=1600;
  camera.scale=scales[lod];
  const result=renderBase(ctx,camera,coverage,scene,
    {terrain:true,grid:true,districts:true,partial:true},null,
    {session,options:{decorations:true,zones:true,lodOverride:lod}});
  const art=result.art;
  document.getElementById("stats-"+lod).textContent=
    "LOD "+art.lod+" · 可见格 "+art.visibleCells+" · 装饰 "+art.props+
    " · 标签 "+art.labels+" · 缓存 "+art.cache.entries+"/"+art.cache.limit+
    " · 命中 "+art.cache.hits+" / 未命中 "+art.cache.misses;
}
async function boot(){
  try{
    const response=await fetch(fixtureUrl,{cache:"no-store",credentials:"omit"});
    if(!response.ok)throw Error("SYNTHETIC_GALLERY_SOURCE_HTTP_"+response.status);
    scene=assertSyntheticScene(await response.json());
    coverage=buildSyntheticCoverage(scene);
    for(const lod of LOD_LEVELS)renderPanel(lod);
    document.getElementById("gallery").dataset.ready="true";
    new ResizeObserver(()=>{
      for(const lod of LOD_LEVELS)renderPanel(lod);
    }).observe(document.getElementById("gallery"));
  }catch(error){
    const box=document.getElementById("gallery-error");
    box.hidden=false;
    box.textContent="虚构场景无法载入："+error.message;
    document.getElementById("gallery").dataset.ready="error";
  }
}
void boot();
