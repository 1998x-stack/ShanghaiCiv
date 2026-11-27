import {ART_SEED,ART_TOKENS} from "./tokens.mjs";
import {activeLod} from "./lod.mjs";
import {descriptorsForCell} from "./props.mjs";
import {placeLabels} from "./labels.mjs";
import {SYNTHETIC_ZONES,assertSyntheticZones} from "./zones.mjs";
import {ArtCache} from "./cache.mjs";
const STYLE=ART_TOKENS;
export function createArtSession(limit=192){
 return {cache:new ArtCache(limit),seed:ART_SEED,draws:0};
}
function paintShape(ctx,x,y,size,kind,rotation){
 const s=Math.max(1.2,size);
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
 ctx.lineWidth=Math.max(.8,s*.12);
 if(kind==="tree"||kind==="shrub"){
   ctx.fillStyle=kind==="tree"?STYLE.foliage:"#789f85";
   ctx.beginPath();ctx.arc(0,0,kind==="tree"?s:s*.7,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="rgba(22,50,39,.30)";
   ctx.beginPath();ctx.arc(-s*.3,-s*.25,s*.34,0,Math.PI*2);ctx.fill();
 }else if(kind==="roof"){
   ctx.fillStyle=STYLE.structure;ctx.fillRect(-s*.7,-s*.5,s*1.4,s);
   ctx.fillStyle=STYLE.roof;ctx.beginPath();
   ctx.moveTo(-s*.9,-s*.5);ctx.lineTo(0,-s*1.2);ctx.lineTo(s*.9,-s*.5);ctx.closePath();ctx.fill();
 }else{
   ctx.strokeStyle=STYLE.wave;ctx.beginPath();
   ctx.moveTo(-s,0);ctx.quadraticCurveTo(-s*.5,-s*.7,0,0);
   ctx.quadraticCurveTo(s*.5,s*.7,s,0);ctx.stroke();
   if(kind==="ripple"){
     ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(0,s*.8,s*.4,0,Math.PI);ctx.stroke();
   }
 }
 ctx.restore();
}
function labelRect(ctx,text,x,y,small=false){
 const width=Math.ceil(ctx.measureText(text).width)+(small?26:24);
 return {x:x-width/2,y:y-(small?10:14),w:width,h:small?20:28};
}
function drawBadge(ctx,rect,text,fill){
 ctx.fillStyle=STYLE.labelBg;
 ctx.beginPath();ctx.roundRect(rect.x,rect.y,rect.w,rect.h,7);ctx.fill();
 ctx.strokeStyle=fill;ctx.lineWidth=1;ctx.stroke();
 ctx.fillStyle=STYLE.labelInk;ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.fillText(text,rect.x+rect.w/2,rect.y+rect.h/2);
}
export function renderArt(ctx,camera,coverage,scene,session,options={}){
 if(scene?.synthetic!==true||scene?.canonical_crs!=="SYNTHETIC_LOCAL_METERS")
   throw new Error("ART_REAL_GEOGRAPHY_BLOCKED");
 if(!session?.cache)throw new Error("ART_SESSION_REQUIRED");
 const lod=activeLod(camera.scale,coverage.grid.radius_m,options.lodOverride??"auto");
 const shown=coverage.grid.visibleCells(...camera.viewportWorld(24));
 let props=0;
 if(options.decorations!==false){
   const radius=coverage.grid.radius_m;
   for(const cellId of shown){
     const cell=coverage.cells[cellId];
     if(cell.partial_cell||(cell.land_fraction<.92&&cell.water_fraction<.92))continue;
     const kind=cell.water_fraction>.58?"water":"land";
     const key=session.seed+"/"+cellId+"/"+lod+"/"+kind;
     const descriptors=session.cache.getOrCreate(key,
       ()=>descriptorsForCell(cellId,cell,lod,session.seed));
     const [col,row]=coverage.grid.colRow(cellId);
     const [cx,cy]=coverage.grid.center(col,row);
     const [sx,sy]=camera.worldToScreen(cx,cy);
     if(lod==="overview")continue;
     for(const d of descriptors){
       const px=sx+d.x*radius*camera.scale,py=sy+d.y*radius*camera.scale;
       const size=Math.min(13,Math.max(1.8,d.size*radius*camera.scale));
       paintShape(ctx,px,py,size,d.kind,d.rotation);props++;
     }
   }
 }
 const labels=drawLabels(ctx,camera,scene,{zones:options.zones!==false,
   regionLabels:options.regionLabels!==false});
 session.draws++;
 return {lod,visibleCells:shown.length,props,labels,cache:session.cache.stats(),draws:session.draws};
}
export function drawLabels(ctx,camera,scene,{zones=true,regionLabels=true}={}){
 assertSyntheticZones(scene);
 const candidates=[];
 const within=(x,y)=>x>=-40&&y>=-40&&x<=camera.width+40&&y<=camera.height+40;
 ctx.save();ctx.font="600 12px system-ui,sans-serif";
 if(zones)for(const zone of SYNTHETIC_ZONES){
   const [sx,sy]=camera.worldToScreen(zone.x,zone.y);
   if(!within(sx,sy))continue;
   candidates.push({id:zone.id,type:"zone",ref:zone,text:zone.label,
     priority:5,box:labelRect(ctx,zone.label,sx,sy,true)});
 }
 if(regionLabels)for(const item of [
   {id:"district-a",text:"虚构甲区",x:1000,y:1100},
   {id:"district-b",text:"虚构乙区",x:5500,y:1150},
   {id:"island",text:"虚构离岛",x:4800,y:3900}
 ]){
   const [sx,sy]=camera.worldToScreen(item.x,item.y);
   if(!within(sx,sy))continue;
   candidates.push({id:item.id,type:"region",priority:3,text:item.text,
     box:labelRect(ctx,item.text,sx,sy,false)});
 }
 const placed=placeLabels(candidates,camera.width,camera.height,8);
 for(const p of placed){
   const color=p.type==="region"?"#d0dad1":STYLE[p.ref.type];
   drawBadge(ctx,p.box,p.text,color);
 }
 ctx.restore();
 return placed.length;
}
