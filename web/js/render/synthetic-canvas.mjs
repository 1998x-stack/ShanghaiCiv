/** Canvas 2D renderer. All shapes originate from entirely fictional P04 fixture. */

function polygonPath(ctx,pts,camera) {
  if(!pts.length)return;
  const [x0,y0]=camera.worldToScreen(...pts[0]);
  ctx.moveTo(x0,y0);
  for(let i=1;i<pts.length;i++) {
    const [x,y]=camera.worldToScreen(...pts[i]);
    ctx.lineTo(x,y);
  }
  ctx.closePath();
}
function featurePaths(geom) {
  const polys=geom.type==="Polygon"?[geom.coordinates]:geom.coordinates;
  return polys.flatMap(poly=>poly);
}
function strokeFeature(ctx,geom,camera) {
  ctx.beginPath();
  for(const ring of featurePaths(geom))polygonPath(ctx,ring,camera);
  ctx.stroke();
}
function hexPath(ctx,grid,id,camera) {
  const [c,r]=grid.colRow(id);
  ctx.beginPath();
  polygonPath(ctx,grid.vertices(c,r),camera);
}
function landColor(cell,membership) {
  const a=membership.some(m=>m.region_id==="synthetic-district-a");
  const b=membership.some(m=>m.region_id==="synthetic-district-b");
  const strength=cell.land_fraction;
  if(!strength)return "#263746";
  if(a&&b)return "#b5a483";
  if(a)return strength>.9?"#7eaa87":"#648775";
  if(b)return strength>.9?"#c9aa72":"#a78b69";
  return "#63857b";
}

/**
 * Thematic overlay fills entire fictional district polygons, not hex cells.
 * It must never imply that a district metric is an observed hex value.
 */
function renderDistrictThematic(ctx,camera,scene,lensView) {
  if(!lensView || lensView.granularity!=="district" || lensView.synthetic!==true)
    return;
  const colors=new Map(lensView.items.map(i=>[i.id,i.color]));
  ctx.save();
  ctx.globalAlpha=.47;
  for(const feature of scene.regions) {
    const color=colors.get(feature.id);
    if(!color)continue;
    ctx.beginPath();
    for(const ring of featurePaths(feature.geometry))polygonPath(ctx,ring,camera);
    ctx.fillStyle=color;
    ctx.fill("evenodd"); // keep fictional island and holes topologically correct
  }
  ctx.restore();
}

export function renderBase(ctx,camera,coverage,scene,layers,lensView=null) {
  ctx.clearRect(0,0,camera.width,camera.height);
  const bg=ctx.createLinearGradient(0,0,camera.width,camera.height);
  bg.addColorStop(0,"#111f2c");bg.addColorStop(1,"#1d3040");
  ctx.fillStyle=bg;ctx.fillRect(0,0,camera.width,camera.height);
  const {grid,byCell}=coverage;
  const visible=grid.visibleCells(...camera.viewportWorld(15));
  for(const id of visible) {
    const cell=coverage.cells[id];
    hexPath(ctx,grid,id,camera);
    const members=byCell.get(id)||[];
    if(layers.terrain) {
      ctx.fillStyle=cell.water_fraction>.6?"#2c6480":
        cell.water_fraction>.02?"#386476":
        landColor(cell,members);
    } else ctx.fillStyle=landColor(cell,members);
    ctx.fill();
    if(layers.grid) {
      ctx.strokeStyle="rgba(221,235,230,.22)";
      ctx.lineWidth=1;
      ctx.stroke();
    }
    if(layers.partial && cell.partial_cell) {
      const [cx,cy]=camera.worldToScreen(...grid.center(...grid.colRow(id)));
      ctx.beginPath();ctx.arc(cx,cy,2.5,0,Math.PI*2);
      ctx.fillStyle="#f3d186";ctx.fill();
    }
  }
  renderDistrictThematic(ctx,camera,scene,lensView);
  if(layers.districts) {
    for(const feature of scene.regions) {
      ctx.strokeStyle=feature.id.endsWith("-a")?"#d2f6d9":"#fce2ab";
      ctx.lineWidth=2.3;
      ctx.setLineDash([8,5]);
      strokeFeature(ctx,feature.geometry,camera);
      ctx.setLineDash([]);
    }
    ctx.font="600 13px system-ui, sans-serif";
    ctx.textAlign="center";ctx.textBaseline="middle";
    for(const [text,x,y] of [["虚构甲区",1000,1100],["虚构乙区",5400,1150],["虚构离岛",4800,3900]]) {
      const [sx,sy]=camera.worldToScreen(x,y);
      if(sx<-100||sy<-50||sx>camera.width+100||sy>camera.height+50)continue;
      const width=ctx.measureText(text).width+23;
      ctx.fillStyle="rgba(12,27,37,.76)";
      ctx.beginPath();ctx.roundRect(sx-width/2,sy-12,width,24,6);ctx.fill();
      ctx.fillStyle="#f0ebd7";ctx.fillText(text,sx,sy);
    }
  }
  return {visibleCells:visible.length,totalCells:grid.size};
}

export function renderOverlay(ctx,camera,coverage,{hovered,selected}) {
  ctx.clearRect(0,0,camera.width,camera.height);
  for(const [id,stroke,width,fill] of [
    [hovered,"#f3d9a6",1.8,"rgba(251,217,158,.09)"],
    [selected,"#fff7d6",3.2,"rgba(250,239,184,.16)"]
  ]) {
    if(id==null||id<0||id>=coverage.grid.size)continue;
    hexPath(ctx,coverage.grid,id,camera);
    ctx.fillStyle=fill;ctx.fill();
    ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
  }
}

export function drawScalebar(ctx,camera) {
  const metres=1000;
  const length=metres*camera.scale;
  if(length>camera.width*.3||length<24)return;
  const x=25,y=camera.height-24;
  ctx.strokeStyle="#dbe9df";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+length,y);ctx.stroke();
  ctx.fillStyle="#dbe9df";ctx.font="11px system-ui,sans-serif";ctx.textAlign="left";
  ctx.fillText("1 km · 虚构坐标",x,y-9);
}
